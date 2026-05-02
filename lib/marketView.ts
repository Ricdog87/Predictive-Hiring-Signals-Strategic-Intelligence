import type {
  CompanyAggregate,
  CompanySignal,
  HiringSignalType,
} from "./types";
import type {
  MarketOverview,
  SectorTrend,
  RegionTrend,
  MarketCluster,
} from "./uiContracts/market";

/**
 * Codex → UI view-model layer.
 *
 * Codex owns the canonical domain model (CompanyAggregate, CompanySignal,
 * HiringScoreResult, HiringPrediction). The dashboard components consume a
 * thinner, view-friendly shape: `CompanyView`. This file is the only place
 * where the two meet — every UI component depends on `CompanyView` and never
 * reaches into Codex types directly.
 *
 * The Market Intelligence panels consume Codex's API response shapes
 * directly via `lib/uiContracts/market.ts`, since those shapes are already
 * presentational.
 */

export type Strength = "weak" | "moderate" | "strong" | "critical";
export type ConfidenceTier = "low" | "medium" | "high";
export type ForecastBand = "imminent" | "near-term" | "mid-term" | "watch";

export interface ScoreDriver {
  signalType: HiringSignalType;
  weight: number; // confidence-adjusted weighted contribution (rounded)
}

export interface CompanyView {
  id: string;
  name: string;
  industry: string;
  region: string; // headquarters used as region surface
  headquarters: string;
  employeeCount: number;
  description: string;
  hiringScore: number; // 0..100
  confidenceScore: number; // 0..100
  hiringProbability: number; // 0..100 (display %)
  expectedHiringWindowDays: number;
  expectedRoleClusters: string[];
  modelVersion: string;
  computedAt: string;
  reasons: string[];
  drivers: ScoreDriver[]; // top 3 by absolute contribution
  signals: CompanySignal[];
  positiveSignalCount: number;
  negativeSignalCount: number;
  isNegativeFlagged: boolean;
  rolesMomentum: number; // proxy: avg(impact*confidence) of recent signals
  strength: Strength;
  confidenceTier: ConfidenceTier;
  forecastBand: ForecastBand;
}

const NEGATIVE_SIGNAL_TYPES: HiringSignalType[] = [
  "insolvency",
  "restructuring",
  "mna_sell",
];

export function classifyStrength(score: number): Strength {
  if (score >= 80) return "critical";
  if (score >= 65) return "strong";
  if (score >= 45) return "moderate";
  return "weak";
}

export function classifyConfidence(c: number): ConfidenceTier {
  if (c >= 80) return "high";
  if (c >= 50) return "medium";
  return "low";
}

export function classifyForecastBand(window: number): ForecastBand {
  if (window <= 30) return "imminent";
  if (window <= 60) return "near-term";
  if (window <= 90) return "mid-term";
  return "watch";
}

function rolesMomentum(signals: CompanySignal[]): number {
  if (signals.length === 0) return 0;
  const total = signals.reduce(
    (sum, s) => sum + s.impact * s.confidence,
    0
  );
  return Math.round((total / signals.length) * 10) / 10;
}

export function toCompanyView(agg: CompanyAggregate): CompanyView {
  const score = agg.latestScore;
  const prediction = agg.latestPrediction;
  const hiringScore = score ? score.hiringScore : 0;
  const confidenceScore = score ? score.confidenceScore : 0;
  const window = prediction ? prediction.expectedHiringWindowDays : 120;
  const positiveSignalCount = agg.signals.filter((s) => s.impact > 0).length;
  const negativeSignalCount = agg.signals.filter((s) => s.impact < 0).length;
  const isNegativeFlagged =
    agg.signals.some(
      (s) =>
        s.impact < 0 ||
        NEGATIVE_SIGNAL_TYPES.includes(s.signalType)
    );

  const drivers: ScoreDriver[] = score
    ? [...score.breakdown]
        .sort(
          (a, b) =>
            Math.abs(b.confidenceAdjusted) - Math.abs(a.confidenceAdjusted)
        )
        .slice(0, 3)
        .map((b) => ({
          signalType: b.signalType,
          weight: Math.round(b.confidenceAdjusted * 100) / 100,
        }))
    : [];

  const description = (() => {
    const parts: string[] = [];
    if (agg.signals.length > 0) {
      parts.push(`${agg.signals.length} tracked signals`);
    }
    if (prediction?.expectedRoleClusters?.length) {
      parts.push(
        `expected role clusters: ${prediction.expectedRoleClusters.join(", ")}`
      );
    }
    if (score?.modelVersion) parts.push(`model ${score.modelVersion}`);
    return parts.join(" · ") || "Awaiting first scored snapshot.";
  })();

  return {
    id: agg.company.id,
    name: agg.company.name,
    industry: agg.company.industry || "unknown",
    region: agg.company.headquarters || "unknown",
    headquarters: agg.company.headquarters || "unknown",
    employeeCount: agg.company.employeeCount,
    description,
    hiringScore,
    confidenceScore,
    hiringProbability: prediction
      ? Math.round(prediction.hiringProbability * 100)
      : 0,
    expectedHiringWindowDays: window,
    expectedRoleClusters: prediction?.expectedRoleClusters ?? [],
    modelVersion: score?.modelVersion ?? "unscored",
    computedAt: score?.computedAt ?? agg.company.updatedAt,
    reasons: score?.reasons ?? [],
    drivers,
    signals: agg.signals,
    positiveSignalCount,
    negativeSignalCount,
    isNegativeFlagged,
    rolesMomentum: rolesMomentum(agg.signals),
    strength: classifyStrength(hiringScore),
    confidenceTier: classifyConfidence(confidenceScore),
    forecastBand: classifyForecastBand(window),
  };
}

export function toCompanyViews(aggs: CompanyAggregate[]): CompanyView[] {
  return aggs.map(toCompanyView).sort((a, b) => b.hiringScore - a.hiringScore);
}

export type {
  MarketOverview,
  SectorTrend,
  RegionTrend,
  MarketCluster,
};
