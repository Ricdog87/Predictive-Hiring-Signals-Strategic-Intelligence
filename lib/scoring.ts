import type { Company, ScoredCompany, SignalStrength } from "./types";

/**
 * Predictive Hiring Score (PHS)
 *
 * Combines weighted, normalized indicators that historically correlate with
 * a hiring window opening in the next 30-90 days. All inputs are clamped
 * to [0, 1] before being weighted, and the final score is scaled to [0, 100].
 *
 * Weights are tuned for the MVP and intentionally exposed here so they can be
 * adjusted from a single location once we plug in real backtesting data.
 */
export const SCORING_WEIGHTS = {
  rolesGrowth30d: 0.22,
  employeeGrowth90d: 0.16,
  fundingRecency: 0.18,
  fundingSize: 0.10,
  leadershipChanges: 0.10,
  techStackShifts: 0.08,
  openRoles: 0.08,
  signalDensity: 0.08,
} as const;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const norm = {
  rolesGrowth30d: (pct: number) => clamp01(pct / 60),
  employeeGrowth90d: (pct: number) => clamp01(pct / 40),
  fundingRecency: (monthsAgo: number) =>
    monthsAgo <= 0 ? 0 : clamp01(1 - monthsAgo / 18),
  fundingSize: (millions: number) => clamp01(millions / 150),
  leadershipChanges: (count: number) => clamp01(count / 4),
  techStackShifts: (count: number) => clamp01(count / 6),
  openRoles: (count: number) => clamp01(count / 80),
  signalDensity: (count: number) => clamp01(count / 6),
};

const driverLabels: Record<keyof typeof SCORING_WEIGHTS, string> = {
  rolesGrowth30d: "Open-roles momentum (30d)",
  employeeGrowth90d: "Headcount growth (90d)",
  fundingRecency: "Funding recency",
  fundingSize: "Funding size",
  leadershipChanges: "Leadership changes",
  techStackShifts: "Tech stack shifts",
  openRoles: "Active open roles",
  signalDensity: "Combined signal density",
};

export function scoreCompany(c: Company): ScoredCompany {
  const components: Record<keyof typeof SCORING_WEIGHTS, number> = {
    rolesGrowth30d: norm.rolesGrowth30d(c.rolesGrowth30d),
    employeeGrowth90d: norm.employeeGrowth90d(c.employeeGrowth90d),
    fundingRecency: norm.fundingRecency(c.lastFundingMonthsAgo),
    fundingSize: norm.fundingSize(c.lastFundingAmountM),
    leadershipChanges: norm.leadershipChanges(c.leadershipChanges90d),
    techStackShifts: norm.techStackShifts(c.techStackShifts),
    openRoles: norm.openRoles(c.openRoles),
    signalDensity: norm.signalDensity(c.signals.length),
  };

  let raw = 0;
  const drivers: { key: keyof typeof SCORING_WEIGHTS; weight: number }[] = [];
  (Object.keys(SCORING_WEIGHTS) as (keyof typeof SCORING_WEIGHTS)[]).forEach((k) => {
    const contribution = components[k] * SCORING_WEIGHTS[k];
    raw += contribution;
    drivers.push({ key: k, weight: contribution });
  });

  const score = Math.round(raw * 100);

  const topDrivers = drivers
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((d) => ({
      label: driverLabels[d.key],
      weight: Math.round(d.weight * 100),
    }));

  return {
    ...c,
    score,
    strength: classifyStrength(score),
    topDrivers,
  };
}

export function classifyStrength(score: number): SignalStrength {
  if (score >= 80) return "critical";
  if (score >= 65) return "strong";
  if (score >= 45) return "moderate";
  return "weak";
}

export function scoreAll(companies: Company[]): ScoredCompany[] {
  return companies.map(scoreCompany).sort((a, b) => b.score - a.score);
}
