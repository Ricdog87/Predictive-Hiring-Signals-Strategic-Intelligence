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
  const avgWindow =
    total === 0
      ? 0
      : Math.round(
          companies.reduce((s, c) => s + c.predictedHiringWindowDays, 0) /
            total
        );
  const positiveMomentum = companies.filter((c) => c.rolesGrowth30d > 0).length;

  const cards: KpiCardProps[] = [
    {
      label: "Tracked Companies",
      value: total.toString(),
      delta: "+3 · 7d",
      tone: "neutral",
      spark: spark([18, 22, 19, 24, 28, 27, 31, total]),
    },
    {
      label: "Critical Signals",
      value: critical.toString(),
      delta: `${strong} strong`,
      tone: "violet",
      hint: "PHS ≥ 80",
      spark: spark([1, 2, 1, 3, 2, 3, 4, critical || 1]),
    },
    {
      label: "Avg Predictive Score",
      value: avgScore.toString(),
      delta: "PHS 0–100",
      tone: "cyan",
      spark: spark([42, 48, 46, 51, 55, 58, 60, avgScore || 1]),
    },
    {
      label: "Predicted Roles · 90d",
      value: predictedRoles.toLocaleString(),
      delta: `${positiveMomentum}/${total} accel.`,
      tone: "green",
      spark: spark([120, 165, 188, 210, 244, 268, 290, predictedRoles || 1]),
    },
    {
      label: "Avg Hiring Window",
      value: `${avgWindow}d`,
      delta: "median 50d",
      tone: "amber",
      spark: spark([88, 78, 72, 65, 60, 55, 52, avgWindow || 1]),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-bg-border bg-bg-border md:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} />
      ))}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  delta: string;
  hint?: string;
  tone: "neutral" | "cyan" | "violet" | "green" | "amber";
  spark: SparkPoint[];
}

function KpiCard({ label, value, delta, hint, tone, spark }: KpiCardProps) {
  const valueColor =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "violet"
      ? "text-accent-violet"
      : tone === "green"
      ? "text-accent-green"
      : tone === "amber"
      ? "text-accent-amber"
      : "text-text-primary";
  const lineColor =
    tone === "cyan"
      ? "#22D3EE"
      : tone === "violet"
      ? "#A78BFA"
      : tone === "green"
      ? "#34D399"
      : tone === "amber"
      ? "#FBBF24"
      : "#7DD3FC";

  return (
    <div className="relative bg-bg-panel p-4">
      <div className="flex items-start justify-between">
        <div className="label-eyebrow">{label}</div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          {hint ?? "live"}
        </span>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className={`num text-3xl font-semibold ${valueColor}`}>
          {value}
        </span>
        <Sparkline points={spark} color={lineColor} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-2xs font-mono uppercase tracking-wider text-text-muted">
          {delta}
        </span>
        <span className="text-2xs font-mono text-text-faint">▲</span>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${lineColor}55, transparent)`,
        }}
      />
    </div>
  );
}

type SparkPoint = { x: number; y: number };

function spark(values: number[]): SparkPoint[] {
  const max = Math.max(...values, 1);
  return values.map((v, i) => ({
    x: (i / (values.length - 1)) * 100,
    y: 100 - (v / max) * 100,
  }));
}

function Sparkline({ points, color }: { points: SparkPoint[]; color: string }) {
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="80"
      height="28"
      className="opacity-90"
    >
      <defs>
        <linearGradient id={`g-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L 100 100 L 0 100 Z`}
        fill={`url(#g-${color})`}
        stroke="none"
      />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={last.x} cy={last.y} r="1.6" fill={color} />
    </svg>
  );
}
