import type { SignalStrength } from "@/lib/types";
import { strengthStyles } from "@/lib/format";

interface ScoreBadgeProps {
  score: number;
  strength: SignalStrength;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, strength, size = "md" }: ScoreBadgeProps) {
  const dim = size === "lg" ? 84 : size === "md" ? 56 : 36;
  const stroke = size === "lg" ? 5 : size === "md" ? 4 : 3;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);

  const color =
    strength === "critical"
      ? "#A78BFA"
      : strength === "strong"
      ? "#22D3EE"
      : strength === "moderate"
      ? "#FBBF24"
      : "#5A6478";

  const fontSize =
    size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-[11px]";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: dim, height: dim }}
    >
      <svg width={dim} height={dim} className="-rotate-90">
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          stroke="#1B2030"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            filter:
              strength === "critical" || strength === "strong"
                ? `drop-shadow(0 0 6px ${color}88)`
                : undefined,
            transition: "stroke-dashoffset 400ms ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-mono font-semibold tabular-nums ${fontSize}`}
          style={{ color }}
        >
          {score}
        </span>
        {size === "lg" && (
          <span className="mt-0.5 text-2xs uppercase tracking-terminal text-text-muted">
            PHS
          </span>
        )}
      </div>
    </div>
  );
}

export function StrengthChip({ strength }: { strength: SignalStrength }) {
  const s = strengthStyles[strength];
  return (
    <span className={`chip ${s.text} ${s.ring} bg-bg-elevated/40`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
