/**
 * Opportunity Engine · v2.
 *
 * Composes a single 0..100 OpportunityScore per company from seven
 * orthogonal factors, sorts them, and returns the top N with a
 * narrative `whyNow` and a recommended action surface (timing +
 * persona archetype). This file does **no** outreach or contact
 * fetching — it produces *labels* derived from public signals.
 *
 * Score factors (each 0..1 before weighting):
 *   - hiringScore        ← lib/scoring.computeHiringScore (weight 0.30)
 *   - signalFreshness    ← exponential decay, half-life 14d (0.18)
 *   - signalStacking     ← saturating count of recent signals (0.14)
 *   - sourceTrust        ← avg trust across cluster sources (0.12)
 *   - dedupStrength      ← how many independent sources agree (0.10)
 *   - seasonalityBoost   ← German hiring cycle bias (0.08)
 *   - regionDemandBoost  ← DACH-priority bias (0.08)
 *
 * The weights sum to 1; OpportunityScore is rounded to one decimal.
 */

import type { CompanyAggregate, CompanySignal, HiringSignalType } from './types';
import { sourceTrustScore } from './sourceTrust';
import { dedupeSignals, type DedupedSignal } from './signalDedup';
import type { IngestRecord } from './ingestStore';

const WEIGHTS = {
  hiringScore: 0.30,
  signalFreshness: 0.18,
  signalStacking: 0.14,
  sourceTrust: 0.12,
  dedupStrength: 0.10,
  seasonalityBoost: 0.08,
  regionDemandBoost: 0.08,
} as const;

export interface OpportunityFactors {
  hiringScore: number;
  signalFreshness: number;
  signalStacking: number;
  sourceTrust: number;
  dedupStrength: number;
  seasonalityBoost: number;
  regionDemandBoost: number;
}

export interface Opportunity {
  companyId: string;
  companyName: string;
  industry: string;
  region: string;
  /** Composite score 0..100. */
  opportunityScore: number;
  /** Confidence 0..1 derived from average trust × freshness × stacking saturation. */
  confidence: number;
  /** Top 3 signal types observed in the recent window, most weighty first. */
  topSignals: HiringSignalType[];
  /** Predicted role clusters (mirrors HiringPrediction). */
  predictedRoles: string[];
  /** Persona label only — no PII, no contact lookup. */
  bestContactPersona: string;
  /** Suggested engagement window: "this week" / "next 2 weeks" / "monitor". */
  recommendedTiming: string;
  whyNow: string;
  factors: OpportunityFactors;
  signalCount: number;
  duplicatesMerged: number;
}

const ROLE_HINTS: Partial<Record<HiringSignalType, string[]>> = {
  patent_filing: ['engineering', 'r&d', 'data'],
  product_launch: ['engineering', 'product', 'gtm'],
  new_business_unit: ['leadership', 'operations', 'gtm'],
  funding_grant: ['gtm', 'engineering', 'finance'],
  location_expansion: ['operations', 'gtm', 'recruiting'],
  job_spike: ['engineering', 'gtm', 'operations'],
  employee_growth: ['recruiting', 'operations', 'people-ops'],
  mna_buy: ['integration-pmo', 'engineering', 'finance'],
  mna_sell: ['transition-leadership'],
  gf_change: ['leadership-transition'],
  restructuring: ['transition-leadership'],
  insolvency: ['restructuring-advisory'],
  press_release: ['gtm'],
};

const PERSONA_HINTS: Partial<Record<HiringSignalType, string>> = {
  patent_filing: 'VP Engineering / Head of R&D',
  product_launch: 'CTO / VP Product',
  new_business_unit: 'Managing Director (new BU)',
  funding_grant: 'COO / Head of People',
  location_expansion: 'Head of Operations / Regional MD',
  job_spike: 'Head of Talent Acquisition',
  employee_growth: 'CHRO / Head of People',
  mna_buy: 'Integration PMO Lead',
  mna_sell: 'CFO / Transaction Lead',
  gf_change: 'Incoming Executive Office',
  restructuring: 'Transformation / Restructuring Lead',
  insolvency: 'Restructuring Advisory',
  press_release: 'Marketing / Comms Lead',
};

const POSITIVE_TYPES = new Set<HiringSignalType>([
  'job_spike',
  'employee_growth',
  'funding_grant',
  'location_expansion',
  'new_business_unit',
  'product_launch',
  'patent_filing',
  'mna_buy',
]);

const HIGH_DEMAND_REGIONS = new Set<string>([
  'DACH · North',
  'DACH · South',
  'DACH · West',
  'DACH · East',
]);

const HIGH_DEMAND_SECTORS = new Set<string>([
  'Industrial AI',
  'Mobility & Automotive',
  'Energy & Utilities',
  'Enterprise Software',
  'Telecom & Cloud',
]);

const MS_PER_DAY = 86_400_000;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function recencyFactor(observedAt: string, now = Date.now()): number {
  const t = new Date(observedAt).getTime();
  if (Number.isNaN(t)) return 0;
  const days = Math.max(0, (now - t) / MS_PER_DAY);
  // Exponential decay, half-life 14 days, floor at 0.05.
  return Math.max(0.05, Math.pow(0.5, days / 14));
}

function freshnessFactor(signals: CompanySignal[]): number {
  if (signals.length === 0) return 0;
  const sum = signals.reduce((acc, s) => acc + recencyFactor(s.observedAt), 0);
  return clamp01(sum / signals.length);
}

function stackingFactor(signals: CompanySignal[]): number {
  if (signals.length === 0) return 0;
  // Saturating: 1 → 0.4, 3 → 0.7, 6 → 0.9, 10+ → ~1.
  return clamp01(1 - Math.pow(0.6, signals.length));
}

function sourceTrustFactor(signals: CompanySignal[]): number {
  if (signals.length === 0) return 0;
  const sum = signals.reduce((acc, s) => acc + sourceTrustScore(s.provider), 0);
  return clamp01(sum / signals.length);
}

function dedupStrengthFactor(deduped: DedupedSignal[]): number {
  if (deduped.length === 0) return 0;
  // Reward independent corroboration without rewarding noise.
  // distinctSources/totalRecords, capped at 1.
  const distinct = deduped.reduce(
    (acc, d) => acc + Math.max(1, d.mergedSources.length),
    0
  );
  const totalDuplicates = deduped.reduce((acc, d) => acc + d.duplicateCount, 0);
  if (totalDuplicates === 0) return 0;
  return clamp01(distinct / totalDuplicates);
}

function seasonalityBoost(now = new Date()): number {
  // German hiring cycle, very rough heuristic:
  //   Jan–Mar: peak (0.95)
  //   Apr–Jun: strong (0.80)
  //   Jul–Aug: trough (0.45)
  //   Sep–Nov: second wave (0.85)
  //   Dec    : trough (0.40)
  const m = now.getUTCMonth(); // 0..11
  if (m <= 2) return 0.95;
  if (m <= 5) return 0.80;
  if (m === 6 || m === 7) return 0.45;
  if (m <= 10) return 0.85;
  return 0.40;
}

function regionDemandBoost(industry: string, region: string): number {
  let score = 0.55;
  if (HIGH_DEMAND_REGIONS.has(region)) score += 0.30;
  if (HIGH_DEMAND_SECTORS.has(industry)) score += 0.15;
  return clamp01(score);
}

function topSignalTypes(signals: CompanySignal[], k = 3): HiringSignalType[] {
  const counts = new Map<HiringSignalType, number>();
  for (const s of signals) {
    const w = Math.abs(s.impact) * s.confidence * recencyFactor(s.observedAt);
    counts.set(s.signalType, (counts.get(s.signalType) ?? 0) + w);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([t]) => t);
}

function predictedRoles(top: HiringSignalType[]): string[] {
  const out = new Set<string>();
  for (const t of top) {
    for (const role of ROLE_HINTS[t] ?? []) out.add(role);
  }
  if (out.size === 0) {
    out.add('gtm');
    out.add('operations');
  }
  return Array.from(out).slice(0, 4);
}

function bestPersona(top: HiringSignalType[]): string {
  for (const t of top) {
    const p = PERSONA_HINTS[t];
    if (p) return p;
  }
  return 'Head of People / Talent Acquisition';
}

function timingFromScore(score: number): string {
  if (score >= 75) return 'Engage this week';
  if (score >= 60) return 'Engage within 2 weeks';
  if (score >= 45) return 'Warm watch · 30-day check-in';
  return 'Cold watch · monitor only';
}

function buildWhyNow(
  agg: CompanyAggregate,
  topTypes: HiringSignalType[],
  freshness: number,
  duplicatesMerged: number
): string {
  const score = agg.latestScore?.hiringScore ?? 0;
  const window = agg.latestPrediction?.expectedHiringWindowDays ?? 120;
  const parts: string[] = [];
  if (topTypes.length > 0) {
    parts.push(`Recent signals: ${topTypes.join(', ')}`);
  }
  parts.push(`hiring score ${Math.round(score)}/100`);
  parts.push(`expected window ~${window} days`);
  if (freshness > 0.6) parts.push('signals are fresh');
  if (duplicatesMerged > 0) {
    parts.push(`${duplicatesMerged} duplicate confirmations`);
  }
  return parts.join(' · ');
}

export interface OpportunityInputs {
  aggregates: CompanyAggregate[];
  liveRecords: IngestRecord[];
}

export interface OpportunityOptions {
  /** How many opportunities to return. Default 25. */
  limit?: number;
  /** Drop companies with composite < this. Default 0. */
  minScore?: number;
  /** "now" override for testing. */
  now?: Date;
}

export function computeOpportunities(
  inputs: OpportunityInputs,
  opts: OpportunityOptions = {}
): Opportunity[] {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 25));
  const minScore = opts.minScore ?? 0;
  const nowDate = opts.now ?? new Date();
  const nowMs = nowDate.getTime();

  // Pre-compute per-company deduped record counts from the live store.
  const liveByCompanyKey = new Map<string, IngestRecord[]>();
  for (const rec of inputs.liveRecords) {
    const key = rec.companyName.toLowerCase().trim();
    const list = liveByCompanyKey.get(key) ?? [];
    list.push(rec);
    liveByCompanyKey.set(key, list);
  }

  const seasonality = seasonalityBoost(nowDate);

  const out: Opportunity[] = [];

  for (const agg of inputs.aggregates) {
    const signals = agg.signals;
    const hiring = (agg.latestScore?.hiringScore ?? 0) / 100;

    const freshness = freshnessFactor(signals);
    const stacking = stackingFactor(signals);
    const trust = sourceTrustFactor(signals);

    const liveRecords =
      liveByCompanyKey.get(agg.company.name.toLowerCase().trim()) ?? [];
    const deduped = dedupeSignals(liveRecords);
    const dedupStrength = dedupStrengthFactor(deduped);
    const duplicatesMerged =
      liveRecords.length - deduped.length;

    const region = regionDemandBoost(agg.company.industry, agg.company.headquarters);

    const factors: OpportunityFactors = {
      hiringScore: clamp01(hiring),
      signalFreshness: freshness,
      signalStacking: stacking,
      sourceTrust: trust,
      dedupStrength,
      seasonalityBoost: seasonality,
      regionDemandBoost: region,
    };

    const composite =
      factors.hiringScore * WEIGHTS.hiringScore +
      factors.signalFreshness * WEIGHTS.signalFreshness +
      factors.signalStacking * WEIGHTS.signalStacking +
      factors.sourceTrust * WEIGHTS.sourceTrust +
      factors.dedupStrength * WEIGHTS.dedupStrength +
      factors.seasonalityBoost * WEIGHTS.seasonalityBoost +
      factors.regionDemandBoost * WEIGHTS.regionDemandBoost;

    const opportunityScore = Math.round(composite * 1000) / 10; // 0..100, 1dp

    if (opportunityScore < minScore) continue;

    const topTypes = topSignalTypes(signals, 3);
    const positiveSlant = topTypes.some((t) => POSITIVE_TYPES.has(t));
    const confidence = clamp01(
      0.5 * trust +
        0.3 * freshness +
        0.2 * (positiveSlant ? stacking : stacking * 0.7)
    );

    out.push({
      companyId: agg.company.id,
      companyName: agg.company.name,
      industry: agg.company.industry,
      region: agg.company.headquarters,
      opportunityScore,
      confidence: Math.round(confidence * 100) / 100,
      topSignals: topTypes,
      predictedRoles: predictedRoles(topTypes),
      bestContactPersona: bestPersona(topTypes),
      recommendedTiming: timingFromScore(opportunityScore),
      whyNow: buildWhyNow(agg, topTypes, freshness, duplicatesMerged),
      factors,
      signalCount: signals.length,
      duplicatesMerged,
    });

    void nowMs; // reserved for future per-signal recency calcs
  }

  out.sort((a, b) => b.opportunityScore - a.opportunityScore);
  return out.slice(0, limit);
}

export const OPPORTUNITY_WEIGHTS = WEIGHTS;
