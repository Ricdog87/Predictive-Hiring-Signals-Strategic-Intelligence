/**
 * Regional aggregation · v1.
 *
 * Turns the raw signal stream + company aggregates into per-Bundesland
 * and per-Quadrant hiring metrics. Pure function, side-effect free,
 * deterministic — designed to be called inside an API route handler.
 *
 * Output shape mirrors the dashboard's needs:
 *   - per-Bundesland: companies, signals, avg score, momentum,
 *     net positive vs negative impact, top signal types, last
 *     observed signal, and a "hiringRate" 0..100 composite.
 *   - per-Quadrant: rolled-up counts, weighted avg score, momentum.
 */

import type { CompanyAggregate, CompanySignal, HiringSignalType } from './types';
import {
  BUNDESLAENDER,
  bundeslaenderByQuadrant,
  type BundeslandRecord,
  type Quadrant,
  resolveBundesland,
} from './germanRegions';
import { getMasterRecordById } from '../src/companyMaster/match';

const POSITIVE_TYPES = new Set<HiringSignalType>([
  'mna_buy',
  'funding_grant',
  'job_spike',
  'employee_growth',
  'location_expansion',
  'new_business_unit',
  'product_launch',
  'patent_filing',
  'press_release',
]);

const NEGATIVE_TYPES = new Set<HiringSignalType>([
  'insolvency',
  'restructuring',
  'mna_sell',
]);

const MS_PER_DAY = 86_400_000;

function recencyFactor(observedAt: string, now = Date.now()): number {
  const t = new Date(observedAt).getTime();
  if (!Number.isFinite(t)) return 0.4;
  const days = Math.max(0, (now - t) / MS_PER_DAY);
  return days <= 14 ? 1.0 : days <= 60 ? 0.75 : days <= 180 ? 0.5 : 0.3;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export interface BundeslandMetric {
  code: string;
  nuts: string;
  name: string;
  quadrant: Quadrant;
  population: number;
  companyCount: number;
  signalCount: number;
  positiveSignalCount: number;
  negativeSignalCount: number;
  averageHiringScore: number;
  /** Recency-weighted impact average (-100..100). */
  netImpact: number;
  /** -1..1 momentum in the last 30 days. */
  momentum30d: number;
  /** Composite 0..100 hiring-rate proxy. */
  hiringRate: number;
  topSignalTypes: HiringSignalType[];
  lastObservedAt: string | null;
  /** Top 5 company names with signals in this Land. */
  leadCompanies: string[];
  /** Optional macro overlay set by the API route after Eurostat fetch. */
  unemploymentRate?: number | null;
  unemploymentPeriod?: string | null;
}

export interface QuadrantMetric {
  id: Quadrant;
  label: string;
  bundeslandCount: number;
  companyCount: number;
  signalCount: number;
  averageHiringScore: number;
  netImpact: number;
  momentum30d: number;
  hiringRate: number;
  topSignalTypes: HiringSignalType[];
  population: number;
  /** Bundesländer ranked by hiringRate desc. */
  bundeslaender: BundeslandMetric[];
}

interface AggregateInput {
  aggregates: CompanyAggregate[];
}

function ranked<T>(map: Map<T, number>, k: number): T[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map((x) => x[0]);
}

function buildLandMetric(
  land: BundeslandRecord,
  companies: CompanyAggregate[]
): BundeslandMetric {
  const signals: CompanySignal[] = companies.flatMap((c) => c.signals);
  const now = Date.now();
  const cutoff30 = now - 30 * MS_PER_DAY;

  let posCount = 0;
  let negCount = 0;
  let weightedImpactSum = 0;
  let weightedImpactDenom = 0;
  const typeCounts = new Map<HiringSignalType, number>();
  let lastObservedAt: string | null = null;

  let momentumNum = 0;
  let momentumDenom = 0;

  for (const s of signals) {
    if (POSITIVE_TYPES.has(s.signalType)) posCount++;
    if (NEGATIVE_TYPES.has(s.signalType)) negCount++;

    const w = s.confidence * recencyFactor(s.observedAt, now);
    weightedImpactSum += s.impact * w;
    weightedImpactDenom += w;

    typeCounts.set(
      s.signalType,
      (typeCounts.get(s.signalType) ?? 0) + Math.abs(s.impact) * s.confidence
    );

    const t = new Date(s.observedAt).getTime();
    if (Number.isFinite(t)) {
      if (!lastObservedAt || t > new Date(lastObservedAt).getTime()) {
        lastObservedAt = s.observedAt;
      }
      if (t >= cutoff30) {
        momentumNum += s.impact * s.confidence;
        momentumDenom += 1;
      }
    }
  }

  const netImpact =
    weightedImpactDenom > 0 ? weightedImpactSum / weightedImpactDenom : 0;
  const momentum30d =
    momentumDenom > 0 ? Math.tanh(momentumNum / (momentumDenom * 25)) : 0;

  const avgHiringScore =
    companies.length > 0
      ? companies.reduce(
          (acc, c) => acc + (c.latestScore?.hiringScore ?? 0),
          0
        ) / companies.length
      : 0;

  // Composite hiring-rate proxy:
  //   45% avg score, 25% net impact (normalized to 0..1), 20% momentum,
  //   10% volume (saturating). Floor at 0.
  const impactNorm = clamp01((netImpact + 100) / 200);
  const momentumNorm = clamp01((momentum30d + 1) / 2);
  const volumeNorm = clamp01(1 - Math.pow(0.85, signals.length));
  const hiringRate = Math.round(
    (0.45 * (avgHiringScore / 100) +
      0.25 * impactNorm +
      0.2 * momentumNorm +
      0.1 * volumeNorm) *
      1000
  ) / 10;

  return {
    code: land.code,
    nuts: land.nuts,
    name: land.name,
    quadrant: land.quadrant,
    population: land.population,
    companyCount: companies.length,
    signalCount: signals.length,
    positiveSignalCount: posCount,
    negativeSignalCount: negCount,
    averageHiringScore: Math.round(avgHiringScore * 10) / 10,
    netImpact: Math.round(netImpact * 10) / 10,
    momentum30d: Math.round(momentum30d * 1000) / 1000,
    hiringRate,
    topSignalTypes: ranked(typeCounts, 3),
    lastObservedAt,
    leadCompanies: companies
      .sort(
        (a, b) =>
          (b.latestScore?.hiringScore ?? 0) -
          (a.latestScore?.hiringScore ?? 0)
      )
      .slice(0, 5)
      .map((c) => c.company.name),
  };
}

export interface RegionalAggregateResult {
  bundeslaender: BundeslandMetric[];
  quadrants: QuadrantMetric[];
  /** Companies whose HQ couldn't be mapped to a Bundesland. */
  unclassifiedCompanyCount: number;
}

export function aggregateRegional({
  aggregates,
}: AggregateInput): RegionalAggregateResult {
  // Group companies by Bundesland. Resolution order:
  //   1. The CompanyProfile.headquarters string (the radar's runtime
  //      enrichment may have rewritten this to the abstract region
  //      label like "DACH · North", which won't match a city — that's
  //      OK, we fall back to step 2).
  //   2. The company-master record's `headquarters` field, which is
  //      always a concrete city ("Hamburg, DE", "Stuttgart, DE").
  //   3. The company name itself (some entity names embed a city).
  const grouped = new Map<string, CompanyAggregate[]>();
  let unclassified = 0;
  for (const agg of aggregates) {
    // v2 fix · check signal.meta first (discovery_dach + classifier signals
    // carry concrete `bundesland` codes + `headquarters` cities directly).
    let land: BundeslandRecord | undefined;
    for (const sig of agg.signals) {
      const meta = (sig as { meta?: { bundesland?: string; headquarters?: string } }).meta;
      if (!meta) continue;
      if (meta.bundesland) {
        const code = String(meta.bundesland).toUpperCase().trim();
        const found = BUNDESLAENDER.find((b) => b.code === code);
        if (found) {
          land = found;
          break;
        }
      }
      if (meta.headquarters) {
        const resolved = resolveBundesland(meta.headquarters);
        if (resolved) {
          land = resolved;
          break;
        }
      }
    }
    // Fallback chain: company.headquarters -> master record -> company name
    if (!land) {
      const masterRecord = getMasterRecordById(agg.company.id);
      land =
        resolveBundesland(agg.company.headquarters) ??
        resolveBundesland(masterRecord?.headquarters) ??
        resolveBundesland(agg.company.name);
    }
    if (!land) {
      unclassified++;
      continue;
    }
    const list = grouped.get(land.code) ?? [];
    list.push(agg);
    grouped.set(land.code, list);
  }

  const landMetrics: BundeslandMetric[] = BUNDESLAENDER.map((land) =>
    buildLandMetric(land, grouped.get(land.code) ?? [])
  );

  const quadrants: QuadrantMetric[] = (
    ['nord', 'ost', 'sued', 'west'] as Quadrant[]
  ).map((q) => {
    const lands = bundeslaenderByQuadrant(q);
    const codes = new Set(lands.map((l) => l.code));
    const inQuadrant = landMetrics.filter((m) => codes.has(m.code));

    const companyCount = inQuadrant.reduce((a, b) => a + b.companyCount, 0);
    const signalCount = inQuadrant.reduce((a, b) => a + b.signalCount, 0);
    const population = lands.reduce((a, b) => a + b.population, 0);

    // Quadrant-level avg = signal-volume-weighted to avoid empty Lands diluting.
    const sumScore = inQuadrant.reduce(
      (a, b) => a + b.averageHiringScore * Math.max(1, b.signalCount),
      0
    );
    const denomScore = inQuadrant.reduce(
      (a, b) => a + Math.max(1, b.signalCount),
      0
    );
    const avgScore = denomScore > 0 ? sumScore / denomScore : 0;

    const sumImpact = inQuadrant.reduce(
      (a, b) => a + b.netImpact * Math.max(1, b.signalCount),
      0
    );
    const netImpact = denomScore > 0 ? sumImpact / denomScore : 0;

    const sumMomentum = inQuadrant.reduce(
      (a, b) => a + b.momentum30d * Math.max(1, b.signalCount),
      0
    );
    const momentum30d = denomScore > 0 ? sumMomentum / denomScore : 0;

    // Sum signal-type weight across the quadrant
    const typeCounts = new Map<HiringSignalType, number>();
    for (const m of inQuadrant) {
      for (const t of m.topSignalTypes) {
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      }
    }

    // Composite quadrant hiring-rate (same recipe as land)
    const impactNorm = clamp01((netImpact + 100) / 200);
    const momentumNorm = clamp01((momentum30d + 1) / 2);
    const volumeNorm = clamp01(1 - Math.pow(0.92, signalCount));
    const hiringRate =
      Math.round(
        (0.45 * (avgScore / 100) +
          0.25 * impactNorm +
          0.2 * momentumNorm +
          0.1 * volumeNorm) *
          1000
      ) / 10;

    return {
      id: q,
      label: q === 'sued' ? 'Süd' : q === 'nord' ? 'Nord' : q === 'ost' ? 'Ost' : 'West',
      bundeslandCount: lands.length,
      companyCount,
      signalCount,
      averageHiringScore: Math.round(avgScore * 10) / 10,
      netImpact: Math.round(netImpact * 10) / 10,
      momentum30d: Math.round(momentum30d * 1000) / 1000,
      hiringRate,
      topSignalTypes: ranked(typeCounts, 3),
      population,
      bundeslaender: inQuadrant.sort((a, b) => b.hiringRate - a.hiringRate),
    };
  });

  return {
    bundeslaender: landMetrics.sort((a, b) => b.hiringRate - a.hiringRate),
    quadrants: quadrants.sort((a, b) => b.hiringRate - a.hiringRate),
    unclassifiedCompanyCount: unclassified,
  };
}
