/**
 * Hiring Signal Alpha Engine v2 — Company Detail Intelligence
 *
 * Builds the enriched company profile served on demand: master-anchored
 * descriptors, current hiring probability, ranked likely-open role
 * clusters, and a human-readable signal explanation engine.
 */

import { CompanyAggregate, CompanySignal, HiringSignalType } from '../../lib/types';
import { CompanyMasterRecord } from '../companyMaster/master';
import { getMasterRecordById } from '../companyMaster/match';
import {
  HiringPatternMemory,
  HiringWindowProjection,
  SeasonalityProfile,
  buildPatternMemory,
  detectSeasonality,
  projectHiringWindows,
} from './predictive';

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

const ROLE_MAP: Record<HiringSignalType, string[]> = {
  job_spike: ['engineering', 'sales', 'operations'],
  employee_growth: ['operations', 'people', 'engineering'],
  location_expansion: ['operations', 'sales', 'site lead'],
  new_business_unit: ['product', 'engineering', 'go-to-market'],
  funding_grant: ['engineering', 'product', 'finance'],
  product_launch: ['product', 'engineering', 'marketing'],
  patent_filing: ['research', 'engineering', 'data'],
  press_release: ['marketing', 'communications'],
  gf_change: ['executive', 'strategy'],
  mna_buy: ['integration', 'finance', 'operations'],
  mna_sell: ['retention', 'transition'],
  restructuring: ['transformation', 'finance'],
  insolvency: ['restructuring', 'legal'],
};

const SIGNAL_NARRATIVES: Record<HiringSignalType, string> = {
  job_spike: 'Sharp uptick in active job postings indicates immediate recruiting need.',
  employee_growth: 'Headcount has been expanding above sector average.',
  location_expansion: 'New site or office expansion typically pulls in operations and sales hires.',
  new_business_unit: 'New business unit announcements precede multi-role build-outs.',
  funding_grant: 'Recent funding/grants unlock budget for engineering and product hires.',
  product_launch: 'Product launch usually triggers GTM and engineering reinforcement.',
  patent_filing: 'Patent activity suggests R&D investment and technical hiring.',
  press_release: 'Public announcement raises company visibility and recruiting urgency.',
  gf_change: 'Leadership change frequently kicks off strategic re-staffing.',
  mna_buy: 'Acquirer activity drives integration, finance, and ops hiring.',
  mna_sell: 'Target-side activity often slows hiring during the transition.',
  restructuring: 'Restructuring tends to delay net new hiring while teams realign.',
  insolvency: 'Insolvency typically halts recruiting until proceedings resolve.',
};

export interface SignalExplanation {
  signalType: HiringSignalType;
  observedAt: string;
  source: string;
  impact: number;
  confidence: number;
  narrative: string;
  whyItMatters: string;
}

export interface LikelyOpenRole {
  cluster: string;
  weight: number;
  drivenBy: HiringSignalType[];
}

export interface CompanyIntelligenceProfile {
  companyId: string;
  name: string;
  master?: CompanyMasterRecord;
  hiringProbability: number;
  hiringScore: number;
  likelyOpenRoles: LikelyOpenRole[];
  signalExplanations: SignalExplanation[];
  patternMemory: HiringPatternMemory;
  seasonality: SeasonalityProfile;
  windows: HiringWindowProjection;
  generatedAt: string;
}

export function explainSignal(signal: CompanySignal): SignalExplanation {
  return {
    signalType: signal.signalType,
    observedAt: signal.observedAt,
    source: signal.provider,
    impact: signal.impact,
    confidence: round3(signal.confidence),
    narrative: SIGNAL_NARRATIVES[signal.signalType] ?? `${signal.signalType} observed.`,
    whyItMatters: composeWhyItMatters(signal),
  };
}

function composeWhyItMatters(signal: CompanySignal): string {
  const direction = signal.impact >= 0 ? 'positive' : 'negative';
  const strength = Math.abs(signal.impact) >= 15 ? 'strong' : 'moderate';
  const conf = signal.confidence >= 0.8 ? 'high-confidence' : signal.confidence >= 0.6 ? 'mid-confidence' : 'early';
  return `${strength} ${direction} signal from ${signal.provider} (${conf}).`;
}

export function rankLikelyOpenRoles(signals: CompanySignal[]): LikelyOpenRole[] {
  const weights = new Map<string, { weight: number; drivers: Set<HiringSignalType> }>();
  for (const s of signals) {
    const clusters = ROLE_MAP[s.signalType] ?? [];
    const w = Math.max(0.05, s.confidence) * Math.max(1, Math.abs(s.impact)) / 20;
    for (const cluster of clusters) {
      const entry = weights.get(cluster) ?? { weight: 0, drivers: new Set<HiringSignalType>() };
      entry.weight += w;
      entry.drivers.add(s.signalType);
      weights.set(cluster, entry);
    }
  }
  return [...weights.entries()]
    .map(([cluster, e]) => ({ cluster, weight: round2(e.weight), drivenBy: [...e.drivers] }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);
}

export function buildCompanyIntelligence(aggregate: CompanyAggregate): CompanyIntelligenceProfile {
  const { company, signals, latestScore, latestPrediction } = aggregate;
  const master = getMasterRecordById(company.id);
  const sortedSignals = [...signals].sort((a, b) => +new Date(b.observedAt) - +new Date(a.observedAt));
  const explanations = sortedSignals.slice(0, 8).map(explainSignal);
  const likelyOpenRoles = rankLikelyOpenRoles(signals);
  const patternMemory = buildPatternMemory(signals);
  const seasonality = detectSeasonality(signals);
  const windows = projectHiringWindows(signals, latestScore?.hiringScore ?? 0);

  return {
    companyId: company.id,
    name: company.name,
    master,
    hiringProbability: latestPrediction?.hiringProbability ?? 0,
    hiringScore: latestScore?.hiringScore ?? 0,
    likelyOpenRoles,
    signalExplanations: explanations,
    patternMemory,
    seasonality,
    windows,
    generatedAt: new Date().toISOString(),
  };
}
