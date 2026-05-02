"use client";

import type { ScoredCompany } from "@/lib/types";
import {
  FORECAST_STYLES,
  getConfidenceScore,
  getForecastBand,
  getHiringProbability,
  getRoleClusters,
  isNegativeCompany,
  type RoleCluster,
} from "@/lib/uiDerivations";
import { PanelEmpty } from "./EmptyStates";

interface ForecastPanelProps {
  company: ScoredCompany | null;
}

export function ForecastPanel({ company }: ForecastPanelProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Forecast · Predicted Role Clusters</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            UI projection · Codex engine
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          Read-only intelligence
        </span>
      </div>

      {!company ? (
        <PanelEmpty
          title="No company selected"
          hint="Pick a row in the radar to see the forecast band and predicted role mix."
        />
      ) : (
        <ForecastContent company={company} />
      )}
    </div>
  );
}

function ForecastContent({ company }: { company: ScoredCompany }) {
  const probability = getHiringProbability(company);
  const confidence = getConfidenceScore(company);
  const band = getForecastBand(company);
  const f = FORECAST_STYLES[band];
  const clusters = getRoleClusters(company);
  const negative = isNegativeCompany(company);

  return (
    <div className="grid grid-cols-1 gap-px bg-bg-border lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="bg-bg-panel p-5">
        <div className="label-eyebrow mb-2">Forecast Window</div>
        <div className="flex items-baseline gap-2">
          <span className="num text-3xl font-semibold text-text-primary">
            {company.predictedHiringWindowDays}
          </span>
          <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
            days
          </span>
        </div>
        <div className="mt-2">
          <span className={`chip ${f.tone} ${f.ring} bg-bg-surface/60`}>
            <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
            {f.label}
          </span>
        </div>

        <BandTimeline window={company.predictedHiringWindowDays} band={band} />

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-bg-border bg-bg-border">
          <Cell
            label="Hiring Prob."
            value={`${probability}%`}
            tone="cyan"
          />
          <Cell
            label="Confidence"
            value={`${confidence}`}
            tone={
              confidence >= 80
                ? "green"
                : confidence >= 50
                ? "cyan"
                : "amber"
            }
          />
          <Cell
            label="Pred. roles · 90d"
            value={company.predictedRolesNext90d.toString()}
          />
          <Cell label="Open roles" value={company.openRoles.toString()} />
        </div>

        {negative && (
          <div className="mt-4 rounded-sm border border-accent-red/30 bg-accent-red/[0.06] p-2.5">
            <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-accent-red">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-soft" />
              Restructuring risk
            </div>
            <div className="mt-1 text-[11.5px] text-text-secondary">
              Negative signals detected: layoff / pivot or contracting headcount.
              Forecast may not represent net hiring.
            </div>
          </div>
        )}
      </div>

      <div className="bg-bg-panel p-5">
        <div className="flex items-center justify-between">
          <div className="label-eyebrow">Predicted Role Clusters</div>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            distribution · next 90d
          </span>
        </div>
        <ClusterBars clusters={clusters} />

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {clusters.map((c) => (
            <ClusterTile key={c.label} cluster={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BandTimeline({
  window,
  band,
}: {
  window: number;
  band: keyof typeof FORECAST_STYLES;
}) {
  const max = 120;
  const pct = Math.min(100, (window / max) * 100);
  const bands: { label: string; pct: number; tone: string }[] = [
    { label: "Imminent", pct: 25, tone: "bg-accent-violet" },
    { label: "Near", pct: 25, tone: "bg-accent-cyan" },
    { label: "Mid", pct: 25, tone: "bg-accent-amber" },
    { label: "Watch", pct: 25, tone: "bg-text-muted" },
  ];
  const f = FORECAST_STYLES[band];
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

function ClusterBars({ clusters }: { clusters: RoleCluster[] }) {
  const colors = ["#22D3EE", "#A78BFA", "#34D399", "#FBBF24", "#7DD3FC"];
  return (
    <div className="mt-3">
      <div className="flex h-3 overflow-hidden rounded-sm ring-1 ring-bg-border">
        {clusters.map((c, i) => (
          <div
            key={c.label}
            style={{
              width: `${c.share * 100}%`,
              backgroundColor: colors[i % colors.length],
              opacity: 0.85,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-2xs uppercase tracking-wider text-text-secondary">
        {clusters.map((c, i) => (
          <span key={c.label} className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span>{c.label}</span>
            <span className="text-text-muted">
              {Math.round(c.share * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ClusterTile({ cluster }: { cluster: RoleCluster }) {
  const trendIcon =
    cluster.trend === "up" ? "▲" : cluster.trend === "down" ? "▼" : "—";
  const trendTone =
    cluster.trend === "up"
      ? "text-accent-green"
      : cluster.trend === "down"
      ? "text-accent-red"
      : "text-text-muted";
  return (
    <div className="rounded-sm border border-bg-border bg-bg-surface/60 p-3">
      <div className="label-eyebrow">{cluster.label}</div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="num text-lg font-semibold text-text-primary">
          {cluster.count}
        </span>
        <span className={`font-mono text-2xs ${trendTone}`}>{trendIcon}</span>
      </div>
      <div className="mt-1 font-mono text-2xs uppercase tracking-wider text-text-muted">
        {Math.round(cluster.share * 100)}% of forecast
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
