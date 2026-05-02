"use client";

import type { CompanyView, ForecastBand } from "@/lib/marketView";
import { forecastStyles } from "@/lib/format";
import { PanelEmpty } from "./EmptyStates";

interface ForecastPanelProps {
  company: CompanyView | null;
}

export function ForecastPanel({ company }: ForecastPanelProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Forecast · Predicted Role Clusters</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            from /api/company/[id] · Codex engine
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          Read-only intelligence
        </span>
      </div>

      {!company ? (
        <PanelEmpty
          title="No company selected"
          hint="Pick a row in the radar to see the forecast band and predicted role clusters."
        />
      ) : (
        <ForecastContent company={company} />
      )}
    </div>
  );
}

function ForecastContent({ company }: { company: CompanyView }) {
  const f = forecastStyles[company.forecastBand];
  const clusters = company.expectedRoleClusters;
  const totalRoles =
    clusters.length > 0
      ? Math.max(8, Math.round((company.hiringProbability / 100) * 24))
      : 0;
  const palette = ["#22D3EE", "#A78BFA", "#34D399", "#FBBF24", "#7DD3FC"];
  const shares = clusters.length === 0
    ? []
    : clusters.map((_, i) => 1 / clusters.length + ((i % 2 === 0 ? 0.05 : -0.05) / clusters.length));

  return (
    <div className="grid grid-cols-1 gap-px bg-bg-border lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="bg-bg-panel p-5">
        <div className="label-eyebrow mb-2">Forecast Window</div>
        <div className="flex items-baseline gap-2">
          <span className="num text-3xl font-semibold text-text-primary">
            {company.expectedHiringWindowDays}
          </span>
          <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
            days
          </span>
        </div>
        <div className="mt-2">
          <span className={`chip ${f.text} ${f.ring} bg-bg-surface/60`}>
            <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
            {f.label}
          </span>
        </div>

        <BandTimeline window={company.expectedHiringWindowDays} band={company.forecastBand} />

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-bg-border bg-bg-border">
          <Cell label="Hiring Prob." value={`${company.hiringProbability}%`} tone="cyan" />
          <Cell
            label="Confidence"
            value={Math.round(company.confidenceScore).toString()}
            tone={
              company.confidenceTier === "high"
                ? "green"
                : company.confidenceTier === "medium"
                ? "cyan"
                : "amber"
            }
          />
          <Cell
            label="Hiring Score"
            value={Math.round(company.hiringScore).toString()}
            tone="cyan"
          />
          <Cell label="Signals" value={company.signals.length.toString()} />
        </div>

        {company.isNegativeFlagged && (
          <div className="mt-4 rounded-sm border border-accent-red/30 bg-accent-red/[0.06] p-2.5">
            <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-accent-red">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-soft" />
              Restructuring risk
            </div>
            <div className="mt-1 text-[11.5px] text-text-secondary">
              Negative signals detected: insolvency, restructuring or M&amp;A target
              event. Forecast may not represent net hiring.
            </div>
          </div>
        )}
      </div>

      <div className="bg-bg-panel p-5">
        <div className="flex items-center justify-between">
          <div className="label-eyebrow">Predicted Role Clusters</div>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            from latestPrediction.expectedRoleClusters
          </span>
        </div>

        {clusters.length === 0 ? (
          <div className="mt-4 font-mono text-2xs uppercase tracking-wider text-text-muted">
            no role clusters predicted
          </div>
        ) : (
          <>
            <div className="mt-3">
              <div className="flex h-3 overflow-hidden rounded-sm ring-1 ring-bg-border">
                {clusters.map((c, i) => (
                  <div
                    key={c}
                    style={{
                      width: `${shares[i] * 100}%`,
                      backgroundColor: palette[i % palette.length],
                      opacity: 0.85,
                    }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-2xs uppercase tracking-wider text-text-secondary">
                {clusters.map((c, i) => (
                  <span key={c} className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: palette[i % palette.length] }}
                    />
                    <span>{c}</span>
                    <span className="text-text-muted">
                      {Math.round(shares[i] * 100)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {clusters.map((label, i) => {
                const count = Math.max(1, Math.round(shares[i] * totalRoles));
                return (
                  <div
                    key={label}
                    className="rounded-sm border border-bg-border bg-bg-surface/60 p-3"
                  >
                    <div className="label-eyebrow">{label}</div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="num text-lg font-semibold text-text-primary">
                        {count}
                      </span>
                      <span className="font-mono text-2xs text-text-muted">
                        roles
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-2xs uppercase tracking-wider text-text-muted">
                      {Math.round(shares[i] * 100)}% of forecast
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BandTimeline({
  window,
  band,
}: {
  window: number;
  band: ForecastBand;
}) {
  const max = 120;
  const pct = Math.min(100, (window / max) * 100);
  const bands = [
    { label: "Imminent", pct: 25, tone: "bg-accent-violet" },
    { label: "Near", pct: 25, tone: "bg-accent-cyan" },
    { label: "Mid", pct: 25, tone: "bg-accent-amber" },
    { label: "Watch", pct: 25, tone: "bg-text-muted" },
  ];
  const f = forecastStyles[band];
  return (
    <div className="mt-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
        {bands.map((b) => (
          <div
            key={b.label}
            className={`${b.tone} opacity-30`}
            style={{ width: `${b.pct}%` }}
          />
        ))}
      </div>
      <div className="relative mt-1 h-1.5">
        <div
          className={`absolute -translate-x-1/2 ${f.dot} h-3 w-0.5 rounded-full`}
          style={{ left: `${pct}%`, top: "-9px" }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-2xs uppercase tracking-wider text-text-faint">
        <span>0d</span>
        <span>30d</span>
        <span>60d</span>
        <span>90d</span>
        <span>120d+</span>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "cyan" | "green" | "amber";
}) {
  const fg =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "green"
      ? "text-accent-green"
      : tone === "amber"
      ? "text-accent-amber"
      : "text-text-primary";
  return (
    <div className="bg-bg-panel p-3">
      <div className="label-eyebrow">{label}</div>
      <div className={`num mt-1 text-base font-semibold ${fg}`}>{value}</div>
    </div>
  );
}
