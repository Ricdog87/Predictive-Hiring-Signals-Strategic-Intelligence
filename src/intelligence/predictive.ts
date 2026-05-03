/**
 * Hiring Signal Alpha Engine v2 — Predictive Layer
 *
 * Models the hiring lag between an observed business signal (expansion,
 * funding, M&A, restructuring, etc.) and the resulting recruiting wave,
 * detects seasonal cadence from the signal stream, and projects 30 / 60
 * / 90-day hiring probabilities.
 */

import { CompanySignal, HiringSignalType } from '../../lib/types';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Average days between a triggering signal and the hiring wave it
 * unlocks. Negative-direction signals (M&A target, restructuring,
 * insolvency) push hiring further out or attenuate it entirely.
 */
export const HIRING_LAG_DAYS: Record<HiringSignalType, number> = {
  job_spike: 7,
  employee_growth: 14,
  location_expansion: 21,
  new_business_unit: 28,
  funding_grant: 30,
  product_launch: 35,
  patent_filing: 45,
  press_release: 50,
  gf_change: 55,
  mna_buy: 60,
  mna_sell: 90,
  restructuring: 90,
  insolvency: 180,
};

const POSITIVE_DRIVERS = new Set<HiringSignalType>([
  'job_spike',
  'employee_growth',
  'location_expansion',
  'new_business_unit',
  'funding_grant',
  'product_launch',
  'patent_filing',
  'mna_buy',
]);

export interface HiringPatternMemory {
  totalSignals: number;
  observedDays: number;
  signalsPerWeek: number;
  averageGapDays: number;
  cadenceStability: number; // 0..1, higher = more rhythmic
  lastObservedAt: string | null;
}

export function buildPatternMemory(signals: CompanySignal[]): HiringPatternMemory {
  if (signals.length === 0) {
    return {
      totalSignals: 0,
      observedDays: 0,
      signalsPerWeek: 0,
      averageGapDays: 0,
      cadenceStability: 0,
      lastObservedAt: null,
    };
  }
  const sorted = [...signals].sort((a, b) => +new Date(a.observedAt) - +new Date(b.observedAt));
  const first = +new Date(sorted[0].observedAt);
  const last = +new Date(sorted[sorted.length - 1].observedAt);
  const observedDays = Math.max(1, (last - first) / 86400000);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((+new Date(sorted[i].observedAt) - +new Date(sorted[i - 1].observedAt)) / 86400000);
  }
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : observedDays;
  const variance = gaps.length
    ? gaps.reduce((a, b) => a + (b - avgGap) ** 2, 0) / gaps.length
    : 0;
  const stability = avgGap > 0 ? clamp(1 - Math.sqrt(variance) / (avgGap + 1)) : 0;
  return {
    totalSignals: sorted.length,
    observedDays: round2(observedDays),
    signalsPerWeek: round2((sorted.length / observedDays) * 7),
    averageGapDays: round2(avgGap),
    cadenceStability: round3(stability),
    lastObservedAt: new Date(last).toISOString(),
  };
}

export interface SeasonalityProfile {
  peakMonths: number[]; // 1..12
  quietMonths: number[];
  monthlyDistribution: Array<{ month: number; share: number }>;
  detected: boolean;
}

export function detectSeasonality(signals: CompanySignal[]): SeasonalityProfile {
  const counts = new Array<number>(12).fill(0);
  for (const s of signals) {
    const month = new Date(s.observedAt).getUTCMonth();
    counts[month]++;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 3) {
    return { peakMonths: [], quietMonths: [], monthlyDistribution: [], detected: false };
  }
  const expected = total / 12;
  const distribution = counts.map((count, idx) => ({
    month: idx + 1,
    share: round3(count / total),
    delta: count - expected,
  }));
  const peak = distribution.filter((d) => d.delta > expected * 0.4).map((d) => d.month);
  const quiet = distribution.filter((d) => d.delta < -expected * 0.4).map((d) => d.month);
  return {
    peakMonths: peak,
    quietMonths: quiet,
    monthlyDistribution: distribution.map(({ month, share }) => ({ month, share })),
    detected: peak.length > 0 || quiet.length > 0,
  };
}

export interface HiringWindowProjection {
  p30: number;
  p60: number;
  p90: number;
  expectedPeakDay: number;
  drivers: Array<{ signalType: HiringSignalType; lagDays: number; weight: number }>;
}

/**
 * Project hiring probability at 30 / 60 / 90 day horizons. Each
 * positive driver contributes a logistic ramp centered on its lag day,
 * weighted by signal confidence and recency.
 */
export function projectHiringWindows(signals: CompanySignal[], hiringScore: number): HiringWindowProjection {
  const now = Date.now();
  const drivers: HiringWindowProjection['drivers'] = [];
  let p30 = 0;
  let p60 = 0;
  let p90 = 0;
  let weightedPeak = 0;
  let weightSum = 0;

  for (const s of signals) {
    if (!POSITIVE_DRIVERS.has(s.signalType)) continue;
    const lag = HIRING_LAG_DAYS[s.signalType];
    const ageDays = Math.max(0, (now - +new Date(s.observedAt)) / 86400000);
    const remaining = lag - ageDays;
    const weight = clamp(s.confidence * Math.exp(-ageDays / 180));
    drivers.push({ signalType: s.signalType, lagDays: lag, weight: round3(weight) });

    p30 += weight * logisticReady(remaining, 30);
    p60 += weight * logisticReady(remaining, 60);
    p90 += weight * logisticReady(remaining, 90);
    weightedPeak += Math.max(7, remaining) * weight;
    weightSum += weight;
  }

  const baseline = clamp(hiringScore / 100) * 0.35;
  const norm = (v: number) => clamp(baseline + v / Math.max(1, drivers.length));
  return {
    p30: round3(norm(p30)),
    p60: round3(norm(p60)),
    p90: round3(norm(p90)),
    expectedPeakDay: weightSum > 0 ? Math.round(weightedPeak / weightSum) : 60,
    drivers: drivers.sort((a, b) => b.weight - a.weight).slice(0, 5),
  };
}

/**
 * Sigmoid that returns ~1 once `remaining` is at or before `horizon`,
 * and falls off as the lag stretches beyond it.
 */
function logisticReady(remaining: number, horizon: number): number {
  const slope = 0.08;
  return 1 / (1 + Math.exp(slope * (remaining - horizon)));
}
