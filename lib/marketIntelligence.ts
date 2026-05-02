import type { ScoredCompany, SignalCategory, Industry, Region } from "./types";
import { getConfidenceScore, isNegativeCompany } from "./uiDerivations";
import type {
  Level,
  MarketCluster,
  MarketOverview,
  MarketTemperature,
  MomentumTrend,
  RegionTrend,
  SectorTrend,
} from "./uiContracts/market";

/**
 * UI-only derivation of Market Intelligence response shapes.
 *
 * Each derive helper returns the same shape the corresponding Codex
 * /api/{market-overview,sectors,regions,clusters} endpoint will return. When
 * the routes go live, components will switch from these derive helpers to
 * `fetch(...).then(r => r.json() as Promise<...>)` — no UI changes needed.
 *
 * IMPORTANT: this file does not introduce backend logic. It is a presentation
 * fallback over the existing scored mock dataset.
 */

export type {
  Level,
  MarketCluster,
  MarketOverview,
  MarketTemperature,
  MomentumTrend,
  RegionTrend,
  SectorTrend,
};

const CATEGORY_LABEL_SHORT: Record<SignalCategory, string> = {
  hiring_velocity: "Hiring",
  funding_round: "Funding",
  leadership_change: "Lead Δ",
  tech_stack_shift: "Stack Δ",
  office_expansion: "Office",
  layoff_pivot: "Layoff",
};

export function shortCategoryLabel(c: SignalCategory): string {
  return CATEGORY_LABEL_SHORT[c];
}

function within24h(iso: string): boolean {
  return (Date.now() - new Date(iso).getTime()) / 86400000 <= 1.5;
}

function classifyTrend(momentum: number): MomentumTrend {
  if (momentum > 8) return "up";
  if (momentum < -2) return "down";
  return "flat";
}

function temperature(avg: number): MarketTemperature {
  if (avg >= 75) return "overheated";
  if (avg >= 60) return "hot";
  if (avg >= 45) return "warm";
  if (avg >= 30) return "cool";
  return "cold";
}

export function deriveMarketOverview(
  companies: ScoredCompany[]
): MarketOverview {
  const total = companies.length;
  const allSignals = companies.flatMap((c) => c.signals);
  const newSignals24h = allSignals.filter((s) =>
    within24h(s.detectedAt)
  ).length;
  const avgScore =
    total === 0
      ? 0
      : Math.round(companies.reduce((s, c) => s + c.score, 0) / total);
  const avgWindow =
    total === 0
      ? 0
      : Math.round(
          companies.reduce((s, c) => s + c.predictedHiringWindowDays, 0) /
            total
        );
  return {
    totalSignals: allSignals.length,
    highProbabilityCompanies: companies.filter((c) => c.score >= 70).length,
    averageHiringScore: avgScore,
    averageHiringWindowDays: avgWindow,
    newSignals24h,
    positiveGrowthSignals: allSignals.filter(
      (s) =>
        s.category === "hiring_velocity" ||
        s.category === "funding_round" ||
        s.category === "office_expansion"
    ).length,
    negativeRiskSignals: allSignals.filter(
      (s) => s.category === "layoff_pivot"
    ).length,
    trackedCompanies: total,
    sevenDayDelta: Math.max(1, Math.round(total * 0.12)),
    marketTemperature: temperature(avgScore),
  };
}

export function deriveSectorTrends(
  companies: ScoredCompany[]
): SectorTrend[] {
  const groups = new Map<Industry, ScoredCompany[]>();
  companies.forEach((c) => {
    const arr = groups.get(c.industry) ?? [];
    arr.push(c);
    groups.set(c.industry, arr);
  });

  const out: SectorTrend[] = [];
  groups.forEach((list, sector) => {
    const signals = list.flatMap((c) => c.signals);
    const avgScore = Math.round(
      list.reduce((s, c) => s + c.score, 0) / list.length
    );
    const avgConfidence = Math.round(
      list.reduce((s, c) => s + getConfidenceScore(c), 0) / list.length
    );
    const momentum =
      list.reduce((s, c) => s + c.rolesGrowth30d, 0) / list.length;

    const catCounts = new Map<SignalCategory, number>();
    signals.forEach((s) =>
      catCounts.set(s.category, (catCounts.get(s.category) ?? 0) + 1)
    );
    const totalSig = signals.length || 1;
    const strongestSignalTypes = Array.from(catCounts.entries())
      .map(([category, count]) => ({ category, share: count / totalSig }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 3);

    const hottest = [...list].sort((a, b) => b.score - a.score)[0];

    out.push({
      sector,
      companies: list.length,
      signalVolume: signals.length,
      averageScore: avgScore,
      averageConfidence: avgConfidence,
      momentum: Math.round(momentum * 10) / 10,
      trend: classifyTrend(momentum),
      hottestCompany: { name: hottest.name, score: hottest.score },
      strongestSignalTypes,
      predictedRoles90d: list.reduce(
        (s, c) => s + c.predictedRolesNext90d,
        0
      ),
      negativeFlags: list.filter(isNegativeCompany).length,
    });
  });

  return out.sort((a, b) => b.averageScore - a.averageScore);
}

export function deriveRegionTrends(
  companies: ScoredCompany[]
): RegionTrend[] {
  const groups = new Map<Region, ScoredCompany[]>();
  companies.forEach((c) => {
    const arr = groups.get(c.region) ?? [];
    arr.push(c);
    groups.set(c.region, arr);
  });

  const out: RegionTrend[] = [];
  groups.forEach((list, region) => {
    const avgScore = Math.round(
      list.reduce((s, c) => s + c.score, 0) / list.length
    );
    const avgConfidence = Math.round(
      list.reduce((s, c) => s + getConfidenceScore(c), 0) / list.length
    );
    const momentum =
      list.reduce((s, c) => s + c.rolesGrowth30d, 0) / list.length;

    const sectorCounts = new Map<Industry, number>();
    list.forEach((c) =>
      sectorCounts.set(c.industry, (sectorCounts.get(c.industry) ?? 0) + 1)
    );
    const totalCount = list.length || 1;
    const dominantSectors = Array.from(sectorCounts.entries())
      .map(([sector, count]) => ({ sector, share: count / totalCount }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 3);

    const germanyShare =
      region === "DACH"
        ? list.filter((c) => /, DE$/.test(c.headquarters)).length /
          (list.length || 1)
        : undefined;

    out.push({
      region,
      companies: list.length,
      averageScore: avgScore,
      averageConfidence: avgConfidence,
      momentum: Math.round(momentum * 10) / 10,
      trend: classifyTrend(momentum),
      dominantSectors,
      predictedRoles90d: list.reduce(
        (s, c) => s + c.predictedRolesNext90d,
        0
      ),
      negativeFlags: list.filter(isNegativeCompany).length,
      germanyShare,
    });
  });

  return out.sort((a, b) => b.averageScore - a.averageScore);
}

export function deriveMarketClusters(
  companies: ScoredCompany[]
): MarketCluster[] {
  const groups = new Map<string, ScoredCompany[]>();
  companies.forEach((c) => {
    const key = `${c.industry}|${c.region}`;
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  });

  const out: MarketCluster[] = [];
  groups.forEach((list, key) => {
    const [sector, region] = key.split("|") as [Industry, Region];
    const avgScore = Math.round(
      list.reduce((s, c) => s + c.score, 0) / list.length
    );
    const momentum =
      list.reduce((s, c) => s + c.rolesGrowth30d, 0) / list.length;
    const negativeFlags = list.filter(isNegativeCompany).length;

    const cats = new Map<SignalCategory, number>();
    list
      .flatMap((c) => c.signals)
      .forEach((s) => cats.set(s.category, (cats.get(s.category) ?? 0) + 1));
    const dominantSignals = Array.from(cats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([c]) => c);

    const opportunityLevel: Level =
      avgScore >= 75 && momentum > 10
        ? "elevated"
        : avgScore >= 60
        ? "high"
        : avgScore >= 45
        ? "medium"
        : "low";

    const riskRatio = negativeFlags / list.length;
    const riskLevel: Level =
      riskRatio >= 0.5
        ? "elevated"
        : riskRatio >= 0.25
        ? "high"
        : riskRatio > 0
        ? "medium"
        : "low";

    out.push({
      sector,
      region,
      companies: list.length,
      averageHiringScore: avgScore,
      momentum: Math.round(momentum * 10) / 10,
      dominantSignals,
      opportunityLevel,
      riskLevel,
    });
  });

  return out;
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
