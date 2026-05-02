import type {
  Company,
  HiringSignal,
  ScoredCompany,
  SignalCategory,
} from "./types";

/**
 * UI-only presentation derivations.
 *
 * These functions never mutate the underlying data model and never call out
 * to any backend. They translate the existing typed shape into display-only
 * concepts the UI surfaces (Hiring Probability, Confidence Score, Role
 * Clusters, Negative-flag, Forecast band).
 *
 * The Codex engine remains the source of truth for the actual numbers — when
 * those become available, these helpers can be replaced by a single import
 * swap.
 */

export function getHiringProbability(c: ScoredCompany): number {
  const adj = Math.min(1, Math.max(0, c.score / 100));
  return Math.round(adj * 92 + 4);
}

export function getConfidenceScore(c: Company): number {
  if (c.signals.length === 0) return 35;
  const mean =
    c.signals.reduce((s, x) => s + x.confidence, 0) / c.signals.length;
  const density = Math.min(1, c.signals.length / 5);
  return Math.round(Math.min(0.99, mean * (0.7 + density * 0.3)) * 100);
}

export type ForecastBand = "imminent" | "near-term" | "mid-term" | "watch";

export function getForecastBand(c: Company): ForecastBand {
  const w = c.predictedHiringWindowDays;
  if (w <= 30) return "imminent";
  if (w <= 60) return "near-term";
  if (w <= 90) return "mid-term";
  return "watch";
}

export function isNegativeCompany(c: Company): boolean {
  return (
    c.signals.some((s) => s.category === "layoff_pivot") ||
    c.rolesGrowth30d < -5 ||
    c.employeeGrowth90d < -2
  );
}

export interface RoleCluster {
  label: string;
  share: number; // 0-1, share of predicted next-90d roles
  count: number;
  trend: "up" | "flat" | "down";
}

const INDUSTRY_CLUSTER_MAP: Record<string, string[]> = {
  "AI/ML": ["ML Research", "Infra & Platform", "Applied AI", "GTM"],
  Fintech: ["Compliance & Risk", "Platform Eng", "Data", "GTM"],
  Healthtech: ["Clinical AI", "Regulatory", "Platform Eng", "GTM"],
  SaaS: ["Platform Eng", "Product", "Data & Analytics", "GTM"],
  Cybersecurity: ["Detection Eng", "Threat Research", "Platform Eng", "GTM"],
  Logistics: ["Operations Tech", "Platform Eng", "Data", "GTM"],
  "E-Commerce": ["Platform Eng", "Growth", "Data", "Operations"],
  "Climate Tech": ["Grid Ops", "Hardware", "Data", "GTM"],
};

export function getRoleClusters(c: ScoredCompany): RoleCluster[] {
  const labels = INDUSTRY_CLUSTER_MAP[c.industry] ?? [
    "Engineering",
    "Product",
    "GTM",
    "Operations",
  ];
  const seed = hashSeed(c.id);
  const weights = labels.map((_, i) => {
    return 0.18 + ((seed * (i + 3)) % 50) / 100;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  const shares = weights.map((w) => w / total);
  const totalRoles = c.predictedRolesNext90d;
  return labels.map((label, i) => ({
    label,
    share: shares[i],
    count: Math.max(1, Math.round(shares[i] * totalRoles)),
    trend:
      shares[i] > 0.3 ? "up" : shares[i] < 0.18 ? "down" : "flat",
  }));
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 1000;
}

export interface MarketPulse {
  totalCompanies: number;
  criticalCount: number;
  strongCount: number;
  avgScore: number;
  signals24h: number;
  signals90d: number;
  predictedRoles90d: number;
  hottestSector: { name: string; score: number };
  topMover: { name: string; delta: number };
  negativeFlags: number;
  marketTemperature: "cold" | "cool" | "warm" | "hot" | "overheated";
}

export function computeMarketPulse(companies: ScoredCompany[]): MarketPulse {
  const total = companies.length;
  const critical = companies.filter((c) => c.strength === "critical").length;
  const strong = companies.filter((c) => c.strength === "strong").length;
  const avg =
    total === 0
      ? 0
      : Math.round(companies.reduce((s, c) => s + c.score, 0) / total);
  const allSignals: (HiringSignal & { score: number })[] = companies.flatMap(
    (c) => c.signals.map((s) => ({ ...s, score: c.score }))
  );
  const within = (days: number) =>
    allSignals.filter(
      (s) =>
        (Date.now() - new Date(s.detectedAt).getTime()) / 86400000 <= days
    ).length;

  const sectorMap = new Map<string, { sum: number; n: number }>();
  companies.forEach((c) => {
    const m = sectorMap.get(c.industry) ?? { sum: 0, n: 0 };
    m.sum += c.score;
    m.n += 1;
    sectorMap.set(c.industry, m);
  });
  let hottest = { name: "—", score: 0 };
  sectorMap.forEach((m, name) => {
    const avg = Math.round(m.sum / m.n);
    if (avg > hottest.score) hottest = { name, score: avg };
  });

  const topMover = [...companies].sort(
    (a, b) => b.rolesGrowth30d - a.rolesGrowth30d
  )[0];

  const negativeFlags = companies.filter(isNegativeCompany).length;

  const temp =
    avg >= 75
      ? "overheated"
      : avg >= 60
      ? "hot"
      : avg >= 45
      ? "warm"
      : avg >= 30
      ? "cool"
      : "cold";

  return {
    totalCompanies: total,
    criticalCount: critical,
    strongCount: strong,
    avgScore: avg,
    signals24h: within(2),
    signals90d: within(90),
    predictedRoles90d: companies.reduce(
      (s, c) => s + c.predictedRolesNext90d,
      0
    ),
    hottestSector: hottest,
    topMover: topMover
      ? { name: topMover.name, delta: topMover.rolesGrowth30d }
      : { name: "—", delta: 0 },
    negativeFlags,
    marketTemperature: temp,
  };
}

export interface SectorAggregate {
  sector: string;
  companies: number;
  avgScore: number;
  avgConfidence: number;
  predictedRoles: number;
  momentum: number;
  negativeFlags: number;
}

export function getSectorAggregates(
  companies: ScoredCompany[]
): SectorAggregate[] {
  const map = new Map<string, ScoredCompany[]>();
  companies.forEach((c) => {
    const arr = map.get(c.industry) ?? [];
    arr.push(c);
    map.set(c.industry, arr);
  });
  return Array.from(map.entries())
    .map(([sector, list]) => {
      const avgScore = Math.round(
        list.reduce((s, c) => s + c.score, 0) / list.length
      );
      const avgConfidence = Math.round(
        list.reduce((s, c) => s + getConfidenceScore(c), 0) / list.length
      );
      const predictedRoles = list.reduce(
        (s, c) => s + c.predictedRolesNext90d,
        0
      );
      const momentum =
        list.reduce((s, c) => s + c.rolesGrowth30d, 0) / list.length;
      const negativeFlags = list.filter(isNegativeCompany).length;
      return {
        sector,
        companies: list.length,
        avgScore,
        avgConfidence,
        predictedRoles,
        momentum: Math.round(momentum * 10) / 10,
        negativeFlags,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);
}

export const TEMPERATURE_STYLES: Record<
  MarketPulse["marketTemperature"],
  { label: string; tone: string; bar: string }
> = {
  cold: { label: "Cold", tone: "text-text-muted", bar: "bg-text-muted" },
  cool: { label: "Cool", tone: "text-accent-ink", bar: "bg-accent-ink" },
  warm: { label: "Warm", tone: "text-accent-amber", bar: "bg-accent-amber" },
  hot: { label: "Hot", tone: "text-accent-cyan", bar: "bg-accent-cyan" },
  overheated: {
    label: "Overheated",
    tone: "text-accent-violet",
    bar: "bg-accent-violet",
  },
};

export const FORECAST_STYLES: Record<
  ForecastBand,
  { label: string; tone: string; ring: string; dot: string }
> = {
  imminent: {
    label: "Imminent",
    tone: "text-accent-violet",
    ring: "ring-accent-violet/40",
    dot: "bg-accent-violet",
  },
  "near-term": {
    label: "Near-term",
    tone: "text-accent-cyan",
    ring: "ring-accent-cyan/40",
    dot: "bg-accent-cyan",
  },
  "mid-term": {
    label: "Mid-term",
    tone: "text-accent-amber",
    ring: "ring-accent-amber/40",
    dot: "bg-accent-amber",
  },
  watch: {
    label: "Watch",
    tone: "text-text-secondary",
    ring: "ring-bg-rule",
    dot: "bg-text-muted",
  },
};

export function getCategoryAttention(category: SignalCategory): "negative" | "neutral" | "positive" {
  if (category === "layoff_pivot") return "negative";
  if (category === "funding_round" || category === "hiring_velocity")
    return "positive";
  return "neutral";
}
