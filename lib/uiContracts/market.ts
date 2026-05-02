/**
 * Market Intelligence response contracts.
 *
 * These types mirror the *exact* shape returned by the Codex Market
 * Intelligence API:
 *
 *   GET /api/market-overview  -> { data: MarketOverview }
 *   GET /api/sectors          -> { data: SectorTrend[] }
 *   GET /api/regions          -> { data: RegionTrend[] }
 *   GET /api/clusters         -> { data: MarketCluster[] }
 *
 * The dashboard consumes these types — and only these types — for the
 * Market Intelligence surfaces. Keep this file in sync with `src/market/types.ts`
 * on the backend (Codex is the source of truth).
 */

export type MomentumTrend = "up" | "flat" | "down";

/** GET /api/market-overview */
export interface MarketOverview {
  totalSignals: number;
  highProbabilityCompanies: number;
  averageHiringScore: number;
  averageHiringWindowDays: number;
  newSignals24h: number;
  hottestSectors: string[];
  hottestRegions: string[];
  negativeRiskSignals: number;
  positiveGrowthSignals: number;
}

/** GET /api/sectors */
export interface SectorTrend {
  sector: string;
  companyCount: number;
  signalVolume: number;
  averageScore: number;
  strongestSignalTypes: string[];
  trendDirection: MomentumTrend;
  confidence: number;
  momentum: number;
}

/** GET /api/regions */
export interface RegionTrend {
  region: string;
  companyCount: number;
  signalVolume: number;
  averageScore: number;
  hottestSectors: string[];
  trendDirection: MomentumTrend;
  confidence: number;
}

/** GET /api/clusters */
export interface MarketCluster {
  sector: string;
  region: string;
  companyCount: number;
  averageHiringScore: number;
  dominantSignals: string[];
  momentum: number;
  riskLevel: number;
  opportunityLevel: number;
}

/** Display-tier mapping for opportunity / risk numeric scores. */
export type Level = "low" | "medium" | "high" | "elevated";

export function levelFromScore(score: number): Level {
  if (score >= 60) return "elevated";
  if (score >= 35) return "high";
  if (score >= 15) return "medium";
  return "low";
}

export function trendFromMomentum(momentum: number): MomentumTrend {
  if (momentum > 0.1) return "up";
  if (momentum < -0.1) return "down";
  return "flat";
}
