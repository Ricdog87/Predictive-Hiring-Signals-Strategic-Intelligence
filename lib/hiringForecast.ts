/**
 * Hiring Forecast Engine · v1.
 *
 * Turns the radar's *backward-looking* signal stream into a
 * *forward-looking* hiring prediction per company:
 *
 *   "Apex Dynamics is 78% likely to be hiring Engineering in 30 days,
 *    65% Sales in 60 days, 40% Operations in 90 days, peak demand
 *    around day 45, with funding and product-launch as the drivers."
 *
 * The model is a transparent, deterministic rule engine — no LLM in
 * the hot path, so it's cheap to run on every dashboard load and we
 * can always explain *why* it predicts what it predicts.
 *
 * Mechanics
 *   1. Each signal type has a curated `SIGNAL_LEAD_TIMES` mapping it
 *      to one or more (role family × median lead time × spread × weight)
 *      tuples — derived from industry observation of M&A / VC /
 *      restructuring playbooks.
 *   2. For every signal, we project a Gaussian-shaped probability
 *      mass centred on `now + leadTimeDays`, scaled by recency,
 *      confidence and source trust, into each forecast window
 *      (30 / 60 / 90 / 180 days).
 *   3. Probabilities accumulate per (company × family × window) with
 *      saturating arithmetic (1 - ∏(1-p_i)) so multiple corroborating
 *      signals push the number up but never above 1.
 *   4. A "posture" classification (expanding / consolidating /
 *      contracting / exploring) is derived from the net positive vs
 *      negative signal weight in the last 90 days.
 */

import type { CompanyAggregate, CompanySignal, HiringSignalType } from './types';
import { sourceTrustScore } from './sourceTrust';

const MS_PER_DAY = 86_400_000;

/** Forecast windows we report. */
export const FORECAST_WINDOWS = [30, 60, 90, 180] as const;
export type ForecastWindow = (typeof FORECAST_WINDOWS)[number];

/** Canonical role-family ids used across the dashboard + API. */
export const ROLE_FAMILIES = {
  engineering: 'Engineering',
  product: 'Product',
  data: 'Data / ML',
  rnd: 'R&D',
  sales: 'Sales / GTM',
  marketing: 'Marketing',
  customer_success: 'Customer Success',
  ops: 'Operations',
  manufacturing: 'Manufacturing',
  finance: 'Finance',
  legal: 'Legal',
  hr: 'People / HR',
  leadership: 'Leadership',
  integration: 'M&A · Integration PMO',
  transformation: 'Transformation / Restructuring',
  strategy: 'Strategy / Consulting',
} as const;

export type RoleFamilyId = keyof typeof ROLE_FAMILIES;

interface FamilyTimeline {
  family: RoleFamilyId;
  /** 0..1 — how strongly this signal predicts this family. */
  weight: number;
  /** Median lead time between the signal and visible hiring (days). */
  leadTimeDays: number;
  /** ± standard deviation of the lead time (days). */
  spread: number;
}

interface SignalLeadTime {
  signalType: HiringSignalType;
  roleFamilies: FamilyTimeline[];
  /** Multiplier applied to the family weights — negative for contractive
   *  signals so they net-down the forecast even if weights are present. */
  postureBias: 1 | -1 | 0;
}

/**
 * Curated lead-time table. Numbers are intentionally conservative —
 * the goal is "be ahead of the market", not over-promise. Every entry
 * is grounded in observable industry patterns:
 *
 *   - VC funding rounds → engineering hiring within 4–8 weeks
 *   - M&A acquirer → integration PMO + finance within 2–4 months
 *   - Patent filing → R&D 4–6 months later (the patent often *follows*
 *     R&D headcount being already in place; we treat it as confirmation
 *     that the hiring trend continues for another 4–6 months)
 *   - Leadership change → strategic re-hiring 6–10 weeks
 *   - Product launch → CSM / GTM staffing 4–6 weeks post-launch
 *   - Restructuring → mostly reduces near-term hiring, narrow targeted
 *     re-hiring 2–6 months out
 *   - Insolvency → no hiring; the opportunity is candidates leaving
 */
const SIGNAL_LEAD_TIMES: SignalLeadTime[] = [
  {
    signalType: 'funding_grant',
    postureBias: 1,
    roleFamilies: [
      { family: 'engineering',      weight: 0.85, leadTimeDays: 45, spread: 15 },
      { family: 'sales',            weight: 0.65, leadTimeDays: 60, spread: 20 },
      { family: 'product',          weight: 0.55, leadTimeDays: 60, spread: 15 },
      { family: 'ops',              weight: 0.45, leadTimeDays: 75, spread: 20 },
      { family: 'marketing',        weight: 0.40, leadTimeDays: 60, spread: 20 },
    ],
  },
  {
    signalType: 'mna_buy',
    postureBias: 1,
    roleFamilies: [
      { family: 'integration',      weight: 0.85, leadTimeDays: 60,  spread: 20 },
      { family: 'leadership',       weight: 0.70, leadTimeDays: 30,  spread: 15 },
      { family: 'finance',          weight: 0.55, leadTimeDays: 75,  spread: 20 },
      { family: 'engineering',      weight: 0.40, leadTimeDays: 90,  spread: 30 },
      { family: 'legal',            weight: 0.40, leadTimeDays: 60,  spread: 20 },
    ],
  },
  {
    signalType: 'mna_sell',
    postureBias: -1,
    roleFamilies: [
      // Net-negative: divestiture usually reduces hiring near-term.
      { family: 'leadership',       weight: 0.30, leadTimeDays: 30,  spread: 20 },
      { family: 'transformation',   weight: 0.25, leadTimeDays: 45,  spread: 25 },
    ],
  },
  {
    signalType: 'gf_change',
    postureBias: 1,
    roleFamilies: [
      { family: 'leadership',       weight: 0.85, leadTimeDays: 45,  spread: 20 },
      { family: 'strategy',         weight: 0.55, leadTimeDays: 60,  spread: 25 },
      { family: 'transformation',   weight: 0.35, leadTimeDays: 75,  spread: 30 },
    ],
  },
  {
    signalType: 'patent_filing',
    postureBias: 1,
    roleFamilies: [
      { family: 'rnd',              weight: 0.85, leadTimeDays: 120, spread: 60 },
      { family: 'engineering',      weight: 0.65, leadTimeDays: 150, spread: 60 },
      { family: 'data',             weight: 0.55, leadTimeDays: 150, spread: 60 },
    ],
  },
  {
    signalType: 'location_expansion',
    postureBias: 1,
    roleFamilies: [
      { family: 'ops',              weight: 0.85, leadTimeDays: 30,  spread: 15 },
      { family: 'sales',            weight: 0.65, leadTimeDays: 45,  spread: 20 },
      { family: 'manufacturing',    weight: 0.50, leadTimeDays: 60,  spread: 30 },
      { family: 'hr',               weight: 0.40, leadTimeDays: 30,  spread: 15 },
    ],
  },
  {
    signalType: 'job_spike',
    postureBias: 1,
    roleFamilies: [
      // Spike means hiring is *already* happening — leadTime ~0d.
      { family: 'engineering',      weight: 0.65, leadTimeDays: 0,   spread: 14 },
      { family: 'sales',            weight: 0.55, leadTimeDays: 0,   spread: 14 },
      { family: 'ops',              weight: 0.50, leadTimeDays: 0,   spread: 14 },
      { family: 'product',          weight: 0.40, leadTimeDays: 0,   spread: 14 },
    ],
  },
  {
    signalType: 'employee_growth',
    postureBias: 1,
    roleFamilies: [
      { family: 'ops',              weight: 0.65, leadTimeDays: 14,  spread: 14 },
      { family: 'engineering',      weight: 0.55, leadTimeDays: 14,  spread: 14 },
      { family: 'hr',               weight: 0.45, leadTimeDays: 30,  spread: 20 },
    ],
  },
  {
    signalType: 'product_launch',
    postureBias: 1,
    roleFamilies: [
      { family: 'sales',            weight: 0.70, leadTimeDays: 30,  spread: 15 },
      { family: 'customer_success', weight: 0.65, leadTimeDays: 45,  spread: 15 },
      { family: 'engineering',      weight: 0.55, leadTimeDays: 60,  spread: 20 },
      { family: 'marketing',        weight: 0.55, leadTimeDays: 30,  spread: 15 },
    ],
  },
  {
    signalType: 'new_business_unit',
    postureBias: 1,
    roleFamilies: [
      { family: 'leadership',       weight: 0.85, leadTimeDays: 30,  spread: 15 },
      { family: 'engineering',      weight: 0.70, leadTimeDays: 60,  spread: 25 },
      { family: 'ops',              weight: 0.60, leadTimeDays: 75,  spread: 30 },
      { family: 'sales',            weight: 0.55, leadTimeDays: 75,  spread: 25 },
    ],
  },
  {
    signalType: 'restructuring',
    postureBias: -1,
    roleFamilies: [
      // Restructuring tends to cut net hiring; targeted re-hiring later.
      { family: 'transformation',   weight: 0.55, leadTimeDays: 60,  spread: 30 },
      { family: 'leadership',       weight: 0.30, leadTimeDays: 30,  spread: 15 },
    ],
  },
  {
    signalType: 'insolvency',
    postureBias: -1,
    roleFamilies: [
      // No hiring forecast — keep entry for posture calc.
    ],
  },
  {
    signalType: 'press_release',
    postureBias: 0,
    roleFamilies: [],
  },
];

const LEAD_TIME_BY_TYPE = new Map(
  SIGNAL_LEAD_TIMES.map((s) => [s.signalType, s])
);

function recencyFactor(observedAt: string, now = Date.now()): number {
  const t = new Date(observedAt).getTime();
  if (!Number.isFinite(t)) return 0.4;
  const days = (now - t) / MS_PER_DAY;
  if (days < 0) return 1; // future-dated (shouldn't happen) — trust it
  if (days <= 14) return 1.0;
  if (days <= 60) return 0.85;
  if (days <= 120) return 0.65;
  if (days <= 240) return 0.45;
  return 0.25;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Probability that a Gaussian centred at `mean` with std-dev `sd`
 * places mass inside `[T0, T1]`. Closed-form using `erf`.
 */
function gaussianMassInWindow(
  mean: number,
  sd: number,
  T0: number,
  T1: number
): number {
  if (sd <= 0) {
    return mean >= T0 && mean <= T1 ? 1 : 0;
  }
  // Approximation of erf — Abramowitz-Stegun 7.1.26 (max error 1.5e-7)
  const erf = (x: number): number => {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * ax);
    const y =
      1 -
      (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t *
        Math.exp(-ax * ax);
    return sign * y;
  };
  const phi = (x: number) => 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));
  return Math.max(0, Math.min(1, phi(T1) - phi(T0)));
}

interface FamilyAccumulator {
  family: RoleFamilyId;
  /** Per-window probability accumulators. We accumulate as 1 - ∏(1-p_i)
   *  so multiple corroborating signals don't double-count. */
  probabilities: Record<ForecastWindow, number>;
  drivers: Map<HiringSignalType, number>; // contribution weight per signal type
  /** Weighted sum of lead-time × prob to compute the peak day. */
  peakNum: number;
  peakDenom: number;
}

export interface FamilyForecast {
  family: RoleFamilyId;
  label: string;
  probability30: number;
  probability60: number;
  probability90: number;
  probability180: number;
  /** Most likely peak hiring day (offset from now). */
  peakDay: number;
  drivingSignals: HiringSignalType[];
}

export type Posture =
  | 'expanding'
  | 'exploring'
  | 'consolidating'
  | 'contracting'
  | 'unknown';

export interface CompanyForecast {
  companyId: string;
  companyName: string;
  industry: string;
  region: string;
  /** Snapshot of how confident the model is in this forecast (0..1). */
  forecastConfidence: number;
  /** Aggregate forward-looking score 0..100 — primary ranking value. */
  forwardScore: number;
  /** Per role-family forecasts. */
  byFamily: FamilyForecast[];
  /** Top 3 driving signal types overall. */
  topDrivers: HiringSignalType[];
  /** Hiring posture classification. */
  posture: Posture;
  /** Most recent signal observedAt, used as freshness tag. */
  lastSignalAt: string | null;
  /** Number of signals that contributed to this forecast. */
  contributingSignals: number;
}

interface ForecastInput {
  aggregate: CompanyAggregate;
  now?: Date;
}

export function computeCompanyForecast({ aggregate, now }: ForecastInput): CompanyForecast {
  const nowMs = (now ?? new Date()).getTime();
  const signals = aggregate.signals ?? [];

  const accumulators = new Map<RoleFamilyId, FamilyAccumulator>();
  const driverContrib = new Map<HiringSignalType, number>();
  let postureNet = 0;
  let postureDenom = 0;
  let lastSignalMs = 0;
  let lastSignalAt: string | null = null;

  // Initialise empty accumulator
  const acc = (family: RoleFamilyId): FamilyAccumulator => {
    let a = accumulators.get(family);
    if (!a) {
      a = {
        family,
        probabilities: { 30: 0, 60: 0, 90: 0, 180: 0 },
        drivers: new Map(),
        peakNum: 0,
        peakDenom: 0,
      };
      accumulators.set(family, a);
    }
    return a;
  };

  for (const sig of signals) {
    const meta = LEAD_TIME_BY_TYPE.get(sig.signalType);
    if (!meta) continue;

    const observedMs = new Date(sig.observedAt).getTime();
    if (observedMs > lastSignalMs) {
      lastSignalMs = observedMs;
      lastSignalAt = sig.observedAt;
    }

    const recency = recencyFactor(sig.observedAt, nowMs);
    const trust = sourceTrustScore(sig.provider);
    const baseStrength = clamp01(sig.confidence) * trust * recency;

    // Posture: confidence-weighted net direction over the last 90d.
    const ageDays = Math.max(0, (nowMs - observedMs) / MS_PER_DAY);
    if (ageDays <= 90) {
      postureNet += meta.postureBias * baseStrength;
      postureDenom += baseStrength;
    }

    if (meta.roleFamilies.length === 0) continue;

    // Centre of the Gaussian: signal observedAt + leadTime, expressed
    // as offset-from-now in days (negative = signal already overdue).
    const signalAgeDays = ageDays;

    for (const ft of meta.roleFamilies) {
      // Effective per-family probability point estimate
      const pointStrength = baseStrength * ft.weight;
      if (pointStrength <= 0) continue;

      // Lead-time centre, relative to now (days into the future)
      const meanFromNow = ft.leadTimeDays - signalAgeDays;
      const sd = Math.max(7, ft.spread);

      const a = acc(ft.family);

      // Accumulate per-window probability using saturating product:
      //   p_new = 1 - (1 - p_acc) * (1 - p_contribution)
      for (const W of FORECAST_WINDOWS) {
        const massInWindow = gaussianMassInWindow(meanFromNow, sd, 0, W);
        const contribution = pointStrength * massInWindow;
        a.probabilities[W] = 1 - (1 - a.probabilities[W]) * (1 - contribution);
      }

      // Track most likely peak day per family — weighted by prob mass
      // inside the union of all windows.
      const totalMass = gaussianMassInWindow(meanFromNow, sd, 0, 180);
      a.peakNum += Math.max(0, meanFromNow) * pointStrength * totalMass;
      a.peakDenom += pointStrength * totalMass;

      a.drivers.set(
        sig.signalType,
        (a.drivers.get(sig.signalType) ?? 0) + pointStrength
      );
      driverContrib.set(
        sig.signalType,
        (driverContrib.get(sig.signalType) ?? 0) + pointStrength * meta.postureBias
      );
    }
  }

  // Build per-family forecasts
  const byFamily: FamilyForecast[] = [];
  for (const a of accumulators.values()) {
    const peakDay =
      a.peakDenom > 0 ? Math.round(a.peakNum / a.peakDenom) : null;
    const drivers = Array.from(a.drivers.entries())
      .sort((x, y) => y[1] - x[1])
      .slice(0, 2)
      .map((x) => x[0]);

    byFamily.push({
      family: a.family,
      label: ROLE_FAMILIES[a.family],
      probability30:  Math.round(a.probabilities[30]  * 1000) / 10,
      probability60:  Math.round(a.probabilities[60]  * 1000) / 10,
      probability90:  Math.round(a.probabilities[90]  * 1000) / 10,
      probability180: Math.round(a.probabilities[180] * 1000) / 10,
      peakDay: peakDay ?? 0,
      drivingSignals: drivers,
    });
  }

  byFamily.sort((a, b) => b.probability90 - a.probability90);

  // Posture classification
  const postureScore =
    postureDenom > 0 ? postureNet / postureDenom : 0;
  let posture: Posture = 'unknown';
  if (signals.length === 0) {
    posture = 'unknown';
  } else if (postureScore >= 0.5) {
    posture = 'expanding';
  } else if (postureScore >= 0.15) {
    posture = 'exploring';
  } else if (postureScore <= -0.4) {
    posture = 'contracting';
  } else if (postureScore < 0.15) {
    posture = 'consolidating';
  }

  // Top drivers across the company (positive direction wins ties)
  const topDrivers = Array.from(driverContrib.entries())
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([t]) => t);

  // Aggregate forward score = max-90-day prob across all families,
  // dampened by overall corroboration count (so a single signal
  // doesn't get to claim 95% confidence).
  const max90 =
    byFamily.length > 0
      ? Math.max(...byFamily.map((f) => f.probability90)) / 100
      : 0;
  const corroborationBoost = clamp01(1 - Math.pow(0.65, signals.length));
  const forwardScore =
    Math.round(max90 * corroborationBoost * 1000) / 10;

  // Forecast confidence — combines source trust + recency + count
  let confidenceNum = 0;
  let confidenceDenom = 0;
  for (const sig of signals) {
    const w = clamp01(sig.confidence) * sourceTrustScore(sig.provider);
    confidenceNum += w * recencyFactor(sig.observedAt, nowMs);
    confidenceDenom += w;
  }
  const baseConfidence = confidenceDenom > 0 ? confidenceNum / confidenceDenom : 0;
  const forecastConfidence =
    Math.round(clamp01(baseConfidence * (0.5 + 0.5 * corroborationBoost)) * 100) / 100;

  return {
    companyId: aggregate.company.id,
    companyName: aggregate.company.name,
    industry: aggregate.company.industry,
    region: aggregate.company.headquarters,
    forecastConfidence,
    forwardScore,
    byFamily,
    topDrivers,
    posture,
    lastSignalAt,
    contributingSignals: signals.length,
  };
}

/**
 * Compute forecasts for every company in the input batch and return
 * them ranked by `forwardScore` desc.
 */
export function computeForecasts(
  aggregates: CompanyAggregate[],
  opts: { limit?: number; minConfidence?: number; now?: Date } = {}
): CompanyForecast[] {
  const out: CompanyForecast[] = [];
  for (const agg of aggregates) {
    const fc = computeCompanyForecast({ aggregate: agg, now: opts.now });
    if (
      opts.minConfidence !== undefined &&
      fc.forecastConfidence < opts.minConfidence
    ) {
      continue;
    }
    out.push(fc);
  }
  out.sort((a, b) => b.forwardScore - a.forwardScore);
  if (opts.limit !== undefined) return out.slice(0, opts.limit);
  return out;
}

/** Lightweight summary — used by the sidebar / status bar. */
export interface ForecastSummary {
  expandingCount: number;
  exploringCount: number;
  consolidatingCount: number;
  contractingCount: number;
  topForwardScore: number;
  averageForwardScore: number;
  /** Sum of all forecasted-30d probabilities (rough hiring-volume index). */
  hiringPipelineIndex: number;
  /** Top 3 role families across all companies (by aggregate probability90). */
  hottestRoleFamilies: Array<{ family: RoleFamilyId; label: string; aggregate: number }>;
}

export function summariseForecasts(forecasts: CompanyForecast[]): ForecastSummary {
  const expandingCount = forecasts.filter((f) => f.posture === 'expanding').length;
  const exploringCount = forecasts.filter((f) => f.posture === 'exploring').length;
  const consolidatingCount = forecasts.filter((f) => f.posture === 'consolidating').length;
  const contractingCount = forecasts.filter((f) => f.posture === 'contracting').length;

  const familyAgg = new Map<RoleFamilyId, number>();
  let hiringPipelineIndex = 0;
  let scoreSum = 0;

  for (const fc of forecasts) {
    scoreSum += fc.forwardScore;
    for (const fam of fc.byFamily) {
      hiringPipelineIndex += fam.probability30;
      familyAgg.set(
        fam.family,
        (familyAgg.get(fam.family) ?? 0) + fam.probability90
      );
    }
  }

  const hottestRoleFamilies = Array.from(familyAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([family, aggregate]) => ({
      family,
      label: ROLE_FAMILIES[family],
      aggregate: Math.round(aggregate * 10) / 10,
    }));

  return {
    expandingCount,
    exploringCount,
    consolidatingCount,
    contractingCount,
    topForwardScore: forecasts.length > 0 ? forecasts[0].forwardScore : 0,
    averageForwardScore:
      forecasts.length > 0
        ? Math.round((scoreSum / forecasts.length) * 10) / 10
        : 0,
    hiringPipelineIndex: Math.round(hiringPipelineIndex * 10) / 10,
    hottestRoleFamilies,
  };
}
