import type { Strength } from "@/lib/marketView";
import { strengthStyles } from "@/lib/format";

interface HiringScoreBadgeProps {
  score: number;
  confidence: number;
  strength: Strength;
  size?: "sm" | "md" | "lg";
}

export function HiringScoreBadge({
  score,
  confidence,
  strength,
  size = "md",
}: HiringScoreBadgeProps) {
  const dim = size === "lg" ? 96 : size === "md" ? 60 : 40;
  const outerStroke = size === "lg" ? 5 : size === "md" ? 4 : 3;
  const innerStroke = size === "lg" ? 3 : size === "md" ? 2.5 : 2;
  const gap = size === "lg" ? 6 : size === "md" ? 4 : 3;

  const ro = (dim - outerStroke) / 2;
  const ri = ro - outerStroke / 2 - gap - innerStroke / 2;
  const co = 2 * Math.PI * ro;
  const ci = 2 * Math.PI * ri;
  const oOff = co * (1 - score / 100);
  const iOff = ci * (1 - confidence / 100);

  const color =
    strength === "critical"
      ? "#6D4FC4"
      : strength === "strong"
      ? "#0E6B85"
      : strength === "moderate"
      ? "#B07C12"
      : "#8E867A";
  const confColor =
    confidence >= 80 ? "#3A8841" : confidence >= 50 ? "#1F7E96" : "#B07C12";

  const fontSize =
    size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-[11px]";

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: dim, height: dim }}
    >
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim / 2} cy={dim / 2} r={ro} stroke="#D8CDB5" strokeWidth={outerStroke} fill="none" />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={ro}
          stroke={color}
          strokeWidth={outerStroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={co}
          strokeDashoffset={oOff}
          style={{
            filter:
              strength === "critical" || strength === "strong"
                ? `drop-shadow(0 0 6px ${color}88)`
                : undefined,
            transition: "stroke-dashoffset 400ms ease",
          }}
        />
        <circle cx={dim / 2} cy={dim / 2} r={ri} stroke="#D8CDB5" strokeWidth={innerStroke} fill="none" />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={ri}
          stroke={confColor}
          strokeWidth={innerStroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={ci}
          strokeDashoffset={iOff}
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`num font-semibold ${fontSize}`} style={{ color }}>
          {Math.round(score)}
        </span>
        {size === "lg" && (
          <div className="mt-0.5 flex items-center gap-1 font-mono text-2xs uppercase tracking-terminal text-text-muted">
            <span style={{ color }}>PHS</span>
            <span className="text-text-faint">·</span>
            <span style={{ color: confColor }}>CONF {Math.round(confidence)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function StrengthChip({ strength }: { strength: Strength }) {
  const s = strengthStyles[strength];
  return (
    <span className={`chip ${s.text} ${s.ring} bg-bg-surface/60`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function ConfidenceChip({ confidence }: { confidence: number }) {
  const tone =
    confidence >= 80
      ? { text: "text-accent-green", ring: "ring-accent-green/40", dot: "bg-accent-green" }
      : confidence >= 50
      ? { text: "text-accent-cyan", ring: "ring-accent-cyan/40", dot: "bg-accent-cyan" }
      : { text: "text-accent-amber", ring: "ring-accent-amber/40", dot: "bg-accent-amber" };
  return (
    <span className={`chip ${tone.text} ${tone.ring} bg-bg-surface/60`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      <span className="num">{Math.round(confidence)}</span>
      <span className="text-text-muted">conf</span>
    </span>
  );
}

export function NegativeSignalChip() {
  return (
    <span className="chip text-accent-red ring-accent-red/40 bg-accent-red/[0.06]">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-soft" />
      Restructuring risk
    </span>
  );
}
