import type {
  Level,
  MarketCluster,
  MarketOverview,
  MomentumTrend,
  RegionTrend,
  SectorTrend,
} from "./uiContracts/market";
import type { CompanyAggregate, HiringSignalType } from "./types";

/**
 * Market Intelligence client + presentation maps.
 *
 * The data fetchers below hit the live Codex Market Intelligence API and
 * return the typed contract shapes from `lib/uiContracts/market.ts`. UI
 * components import only the contract types and the style maps — they never
 * reach into Codex's domain types directly.
 */

interface ApiEnvelope<T> {
  data: T;
  generatedAt: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { next: { revalidate: 30 } });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }
  const body = (await res.json()) as ApiEnvelope<T>;
  return body.data;
}

export function fetchMarketOverview(): Promise<MarketOverview> {
  return getJson<MarketOverview>("/api/market-overview");
}

export function fetchSectorTrends(): Promise<SectorTrend[]> {
  return getJson<SectorTrend[]>("/api/sectors");
}

export function fetchRegionTrends(): Promise<RegionTrend[]> {
  return getJson<RegionTrend[]>("/api/regions");
}

export function fetchMarketClusters(): Promise<MarketCluster[]> {
  return getJson<MarketCluster[]>("/api/clusters");
}

interface CompanyProfileLite {
  id: string;
  name: string;
}

export async function fetchCompanyAggregates(): Promise<CompanyAggregate[]> {
  const profiles = await getJson<CompanyProfileLite[]>("/api/companies");
  const aggregates = await Promise.all(
    profiles.map((p) =>
      getJson<CompanyAggregate>(`/api/company/${encodeURIComponent(p.id)}`)
    )
  );
  return aggregates;
}

export interface CompanyIntelligenceResponse {
  companyId: string;
  name: string;
  hiringScore: number;
  hiringProbability: number;
  likelyOpenRoles: Array<{
    cluster: string;
    weight: number;
    drivenBy: string[];
  }>;
  signalExplanations: Array<{
    signalType: string;
    observedAt: string;
    source: string;
    impact: number;
    confidence: number;
    narrative: string;
    whyItMatters: string;
  }>;
  patternMemory: {
    totalSignals: number;
    observedDays: number;
    signalsPerWeek: number;
    averageGapDays: number;
    cadenceStability: number;
    lastObservedAt: string | null;
  };
  seasonality: {
    peakMonths: number[];
    quietMonths: number[];
    monthlyDistribution: Array<{ month: number; share: number }>;
    detected: boolean;
  };
  windows: {
    p30: number;
    p60: number;
    p90: number;
    expectedPeakDay: number;
    drivers: Array<{ signalType: string; lagDays: number; weight: number }>;
  };
  generatedAt: string;
}

export function fetchCompanyIntelligence(
  id: string,
): Promise<CompanyIntelligenceResponse> {
  return getJson<CompanyIntelligenceResponse>(
    `/api/intelligence/${encodeURIComponent(id)}`,
  );
}

const SIGNAL_TYPE_LABELS: Record<HiringSignalType, string> = {
  mna_buy: "M&A · acquirer",
  mna_sell: "M&A · target",
  gf_change: "Leadership change",
  patent_filing: "Patent filing",
  location_expansion: "Location expansion",
  funding_grant: "Funding / grant",
  press_release: "Press release",
  restructuring: "Restructuring",
  insolvency: "Insolvency",
  job_spike: "Job-posting spike",
  employee_growth: "Employee growth",
  product_launch: "Product launch",
  new_business_unit: "New business unit",
};

const SIGNAL_TYPE_SHORT: Record<HiringSignalType, string> = {
  mna_buy: "M&A buy",
  mna_sell: "M&A sell",
  gf_change: "Lead Δ",
  patent_filing: "Patent",
  location_expansion: "Expansion",
  funding_grant: "Funding",
  press_release: "Press",
  restructuring: "Restruct.",
  insolvency: "Insolv.",
  job_spike: "Jobs",
  employee_growth: "HC Δ",
  product_launch: "Launch",
  new_business_unit: "New BU",
};

const NEGATIVE_TYPES = new Set<HiringSignalType>([
  "insolvency",
  "restructuring",
  "mna_sell",
]);
const POSITIVE_TYPES = new Set<HiringSignalType>([
  "job_spike",
  "employee_growth",
  "funding_grant",
  "location_expansion",
  "new_business_unit",
  "product_launch",
  "patent_filing",
]);

const isKnownSignalType = (t: string): t is HiringSignalType =>
  t in SIGNAL_TYPE_LABELS;

export function signalTypeLabel(t: string): string {
  if (isKnownSignalType(t)) return SIGNAL_TYPE_LABELS[t];
  return t.replace(/_/g, " ");
}

export function signalTypeShortLabel(t: string): string {
  if (isKnownSignalType(t)) return SIGNAL_TYPE_SHORT[t];
  return t.replace(/_/g, " ");
}

export function signalTypeAttention(
  t: string
): "negative" | "positive" | "neutral" {
  if (NEGATIVE_TYPES.has(t as HiringSignalType)) return "negative";
  if (POSITIVE_TYPES.has(t as HiringSignalType)) return "positive";
  return "neutral";
}

export const LEVEL_STYLES: Record<
  Level,
  { label: string; tone: string; ring: string; dot: string; bg: string }
> = {
  low: {
    label: "Low",
    tone: "text-text-secondary",
    ring: "ring-bg-rule",
    dot: "bg-text-muted",
    bg: "bg-bg-elevated/40",
  },
  medium: {
    label: "Medium",
    tone: "text-accent-amber",
    ring: "ring-accent-amber/40",
    dot: "bg-accent-amber",
    bg: "bg-accent-amber/10",
  },
  high: {
    label: "High",
    tone: "text-accent-cyan",
    ring: "ring-accent-cyan/40",
    dot: "bg-accent-cyan",
    bg: "bg-accent-cyan/10",
  },
  elevated: {
    label: "Elevated",
    tone: "text-accent-violet",
    ring: "ring-accent-violet/50",
    dot: "bg-accent-violet",
    bg: "bg-accent-violet/15",
  },
};

export const TREND_STYLES: Record<
  MomentumTrend,
  { glyph: string; tone: string; label: string }
> = {
  up: { glyph: "▲", tone: "text-accent-green", label: "Up" },
  flat: { glyph: "→", tone: "text-text-muted", label: "Flat" },
  down: { glyph: "▼", tone: "text-accent-red", label: "Down" },
};

export const TEMPERATURE_STYLES = {
  cold: { label: "Cold", tone: "text-text-muted", bar: "bg-text-muted" },
  cool: { label: "Cool", tone: "text-accent-ink", bar: "bg-accent-ink" },
  warm: { label: "Warm", tone: "text-accent-amber", bar: "bg-accent-amber" },
  hot: { label: "Hot", tone: "text-accent-cyan", bar: "bg-accent-cyan" },
  overheated: {
    label: "Overheated",
    tone: "text-accent-violet",
    bar: "bg-accent-violet",
  },
} as const;

export type Temperature = keyof typeof TEMPERATURE_STYLES;

export function temperatureForScore(score: number): Temperature {
  if (score >= 75) return "overheated";
  if (score >= 60) return "hot";
  if (score >= 45) return "warm";
  if (score >= 30) return "cool";
  return "cold";
}
