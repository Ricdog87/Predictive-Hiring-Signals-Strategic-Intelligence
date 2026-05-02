import { LEVEL_STYLES, TREND_STYLES } from "@/lib/marketIntelligence";
import type { Level, MomentumTrend } from "@/lib/uiContracts/market";

interface OpportunityBadgeProps {
  level: Level;
}

export function OpportunityBadge({ level }: OpportunityBadgeProps) {
  const s = LEVEL_STYLES[level];
  return (
    <span className={`chip ${s.tone} ${s.ring} ${s.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      Opp · {s.label}
    </span>
  );
}

export function RiskBadge({ level }: { level: Level }) {
  const s = LEVEL_STYLES[level];
  // For risk we want red tones at higher levels rather than violet
  const overrideTone =
    level === "elevated"
      ? { tone: "text-accent-red", ring: "ring-accent-red/40", dot: "bg-accent-red", bg: "bg-accent-red/10" }
      : level === "high"
      ? { tone: "text-accent-red", ring: "ring-accent-red/30", dot: "bg-accent-red", bg: "bg-accent-red/[0.06]" }
      : level === "medium"
      ? { tone: "text-accent-amber", ring: "ring-accent-amber/40", dot: "bg-accent-amber", bg: "bg-accent-amber/10" }
      : null;
  const t = overrideTone ?? s;
  return (
    <span className={`chip ${t.tone} ${t.ring} ${t.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      Risk · {LEVEL_STYLES[level].label}
    </span>
  );
}

interface MomentumArrowProps {
  trend: MomentumTrend;
  value?: number;
  size?: "sm" | "md";
}

export function MomentumArrow({ trend, value, size = "md" }: MomentumArrowProps) {
  const t = TREND_STYLES[trend];
  const text = size === "sm" ? "text-[11px]" : "text-[13px]";
  return (
    <span className={`inline-flex items-center gap-1 font-mono ${t.tone} ${text}`}>
      <span>{t.glyph}</span>
      {typeof value === "number" && (
        <span className="num">{value > 0 ? "+" : ""}{value.toFixed(1)}%</span>
      )}
    </span>
  );
}

export function LevelBar({ level }: { level: Level }) {
  const order: Level[] = ["low", "medium", "high", "elevated"];
  const idx = order.indexOf(level);
  const s = LEVEL_STYLES[level];
  return (
    <div className="flex h-1 gap-px overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
      {order.map((l, i) => {
        const filled = i <= idx;
        return (
          <div
            key={l}
            className={`flex-1 ${filled ? s.dot : "bg-transparent"}`}
          />
        );
      })}
    </div>
  );
}
