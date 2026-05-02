import type { ScoredCompany } from "@/lib/types";

interface KpiCardsProps {
  companies: ScoredCompany[];
}

export function KpiCards({ companies }: KpiCardsProps) {
  const total = companies.length;
  const critical = companies.filter((c) => c.strength === "critical").length;
  const strong = companies.filter((c) => c.strength === "strong").length;
  const avgScore =
    total === 0
      ? 0
      : Math.round(companies.reduce((s, c) => s + c.score, 0) / total);
  const predictedRoles = companies.reduce(
    (s, c) => s + c.predictedRolesNext90d,
    0
  );

  const cards = [
    {
      label: "Tracked Companies",
      value: total.toString(),
      hint: "in active radar",
      accent: "text-text-primary",
    },
    {
      label: "Critical Signals",
      value: critical.toString(),
      hint: `+ ${strong} strong`,
      accent: "text-accent-violet",
    },
    {
      label: "Avg Predictive Score",
      value: avgScore.toString(),
      hint: "PHS, 0–100",
      accent: "text-accent-cyan",
    },
    {
      label: "Predicted Roles · 90d",
      value: predictedRoles.toLocaleString(),
      hint: "across radar",
      accent: "text-accent-green",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="relative overflow-hidden rounded-xl border border-bg-border bg-bg-panel p-5"
        >
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
            {c.label}
          </div>
          <div className={`mt-2 text-3xl font-semibold tabular-nums ${c.accent}`}>
            {c.value}
          </div>
          <div className="mt-1 text-xs text-text-secondary">{c.hint}</div>
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent-cyan/5 blur-2xl" />
        </div>
      ))}
    </div>
  );
}
