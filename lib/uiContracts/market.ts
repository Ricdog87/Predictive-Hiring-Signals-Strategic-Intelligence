import type { Industry, Region, SignalCategory } from "../types";

/**
 * Market Intelligence response contracts.
 *
 * These types define the *exact* shape the dashboard expects from the
 * Codex Market Intelligence API:
 *
 *   GET /api/market-overview  -> MarketOverview
 *   GET /api/sectors          -> SectorTrend[]
 *   GET /api/regions          -> RegionTrend[]
 *   GET /api/clusters         -> MarketCluster[]
 *
 * The UI consumes these types — and only these types — for the Market
 * Intelligence surfaces. Until the routes are live, `lib/marketIntelligence`
 * derives equivalent values from the local scored mock dataset. Replacing
 * those derive helpers with `fetch(...).then(r => r.json())` is the single
 * change required to go live; no component touches `ScoredCompany` directly.
 */

export type MomentumTrend = "up" | "flat" | "down";

export type Level = "low" | "medium" | "high" | "elevated";

export type MarketTemperature =
  | "cold"
  | "cool"
  | "warm"
  | "hot"
  | "overheated";

/** GET /api/market-overview */
export interface MarketOverview {
  totalSignals: number;
  highProbabilityCompanies: number;
  averageHiringScore: number;
  averageHiringWindowDays: number;
  newSignals24h: number;
  positiveGrowthSignals: number;
  negativeRiskSignals: number;
  trackedCompanies: number;
  sevenDayDelta: number;
  marketTemperature: MarketTemperature;
}

/** GET /api/sectors */
export interface SectorTrend {
  sector: Industry;
  companies: number;
  signalVolume: number;
  averageScore: number;
  averageConfidence: number;
  momentum: number;
  trend: MomentumTrend;
  hottestCompany: { name: string; score: number };
  strongestSignalTypes: { category: SignalCategory; share: number }[];
  predictedRoles90d: number;
  negativeFlags: number;
}

/** GET /api/regions */
export interface RegionTrend {
  region: Region;
  companies: number;
  averageScore: number;
  averageConfidence: number;
  momentum: number;
  trend: MomentumTrend;
  dominantSectors: { sector: Industry; share: number }[];
  predictedRoles90d: number;
  negativeFlags: number;
  germanyShare?: number;
}

/** GET /api/clusters */
export interface MarketCluster {
  sector: Industry;
  region: Region;
  companies: number;
  averageHiringScore: number;
  momentum: number;
  dominantSignals: SignalCategory[];
  opportunityLevel: Level;
  riskLevel: Level;
}
