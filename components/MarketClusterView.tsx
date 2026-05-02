"use client";

import { useState } from "react";
import {
  LEVEL_STYLES,
  TREND_STYLES,
  shortCategoryLabel,
} from "@/lib/marketIntelligence";
import type { Industry, Region } from "@/lib/types";
import type { MarketCluster } from "@/lib/uiContracts/market";
import { formatPct } from "@/lib/format";
import { LevelBar, MomentumArrow, OpportunityBadge, RiskBadge } from "./MarketBadges";

interface MarketClusterViewProps {
  clusters: MarketCluster[];
  sectors: Industry[];
  regions: Region[];
}

type ViewMode = "opportunity" | "risk" | "score";

/**
 * Sector × Region heatmap: each cell is a MarketCluster bubble. Cells encode
 * average hiring score in their fill, and opportunity / risk levels in the
 * inset chips. A list of selected cells appears below the matrix.
 */
export function MarketClusterView({
  clusters,
  sectors,
  regions,
}: MarketClusterViewProps) {
  const [mode, setMode] = useState<ViewMode>("opportunity");
  const [selected, setSelected] = useState<MarketCluster | null>(
    clusters[0] ?? null
  );

  const lookup = new Map<string, MarketCluster>();
  clusters.forEach((c) => lookup.set(`${c.sector}|${c.region}`, c));

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Market Cluster Heatmap</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            sector × region · {clusters.length} clusters
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ModeButton active={mode === "opportunity"} onClick={() => setMode("opportunity")}>
            Opportunity
          </ModeButton>
          <ModeButton active={mode === "risk"} onClick={() => setMode("risk")}>
            Risk
          </ModeButton>
          <ModeButton active={mode === "score"} onClick={() => setMode("score")}>
            Score
          </ModeButton>
        </div>
      </div>

      <div className="overflow-x-auto p-3">
        <table className="min-w-full border-separate border-spacing-1 text-[12px]">
          <thead>
            <tr>
              <th className="label-eyebrow sticky left-0 z-10 bg-bg-panel px-2 py-1 text-left">
                Sector \ Region
              </th>
              {regions.map((r) => (
                <th
                  key={r}
                  className="label-eyebrow px-2 py-1 text-center"
                >
                  {r === "DACH" ? (
                    <span className="text-accent-cyan">{r}</span>
                  ) : (
                    r
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectors.map((s) => (
              <tr key={s}>
                <th className="label-eyebrow sticky left-0 z-10 bg-bg-panel px-2 py-1 text-left text-text-secondary">
                  {s}
                </th>
                {regions.map((r) => {
                  const cell = lookup.get(`${s}|${r}`) ?? null;
                  return (
                    <td key={r} className="px-0 py-0">
                      <ClusterCell
                        cluster={cell}
                        mode={mode}
                        selected={
                          selected
                            ? selected.sector === s && selected.region === r
                            : false
                        }
                        onClick={() => cell && setSelected(cell)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-px border-t border-bg-border bg-bg-border lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bg-bg-panel p-4">
          <div className="label-eyebrow mb-2">Legend</div>
          <div className="flex flex-wrap items-center gap-3">
            {(["low", "medium", "high", "elevated"] as const).map((l) => {
              const s = LEVEL_STYLES[l];
              return (
                <div
                  key={l}
                  className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider text-text-secondary"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  <span>{s.label}</span>
                </div>
              );
            })}
            <span className="h-3 w-px bg-bg-rule" />
            {(["up", "flat", "down"] as const).map((tr) => (
              <div
                key={tr}
                className={`flex items-center gap-1 font-mono text-2xs uppercase tracking-wider ${TREND_STYLES[tr].tone}`}
              >
                <span>{TREND_STYLES[tr].glyph}</span>
                <span>{TREND_STYLES[tr].label} momentum</span>
              </div>
            ))}
          </div>
          <div className="mt-3 font-mono text-2xs uppercase tracking-wider text-text-muted">
            Cell fill encodes avg hiring score · {mode} mode highlights{" "}
            {mode === "opportunity"
              ? "opportunityLevel"
              : mode === "risk"
              ? "riskLevel"
              : "averageHiringScore"}
            .
          </div>
        </div>

        <div className="bg-bg-panel p-4">
          <div className="label-eyebrow">Selected cluster</div>
          {selected ? (
            <SelectedCluster cluster={selected} />
          ) : (
            <div className="mt-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
              Pick a cell to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-2 py-0.5 font-mono text-2xs uppercase tracking-wider transition-colors ${
        active
          ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan"
          : "border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function ClusterCell({
  cluster,
  mode,
  selected,
  onClick,
}: {
  cluster: MarketCluster | null;
  mode: ViewMode;
  selected: boolean;
  onClick: () => void;
}) {
  if (!cluster) {
    return (
      <div className="flex h-16 items-center justify-center rounded-sm border border-dashed border-bg-line/60 bg-bg-surface/30 font-mono text-2xs text-text-faint">
        —
      </div>
    );
  }

  const score = cluster.averageHiringScore;
  const intensity = Math.min(1, Math.max(0.05, score / 100));
  const baseColor =
    mode === "risk"
      ? `rgba(248,113,113,${intensity * 0.55})`
      : mode === "opportunity"
      ? cluster.opportunityLevel === "elevated"
        ? `rgba(167,139,250,${intensity * 0.65})`
        : `rgba(34,211,238,${intensity * 0.6})`
      : `rgba(34,211,238,${intensity * 0.6})`;

  const ring = selected
    ? "ring-1 ring-accent-cyan"
    : "ring-1 ring-bg-border hover:ring-accent-cyan/40";
  const tTrend = TREND_STYLES[
    cluster.momentum > 8 ? "up" : cluster.momentum < -2 ? "down" : "flat"
  ];

  return (
    <button
      onClick={onClick}
      className={`relative block h-16 w-full overflow-hidden rounded-sm bg-bg-surface text-left transition-shadow ${ring}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${baseColor}, transparent 70%)`,
      }}
    >
      <div className="flex h-full flex-col justify-between p-1.5">
        <div className="flex items-center justify-between">
          <span className="num text-[12.5px] font-semibold text-text-primary">
            {score}
          </span>
          <span className={`font-mono text-[11px] ${tTrend.tone}`}>
            {tTrend.glyph}
          </span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
          <span className="text-text-muted">{cluster.companies}c</span>
          <div className="flex items-center gap-1">
            {mode !== "risk" && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  LEVEL_STYLES[cluster.opportunityLevel].dot
                }`}
              />
            )}
            {mode !== "opportunity" && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  cluster.riskLevel === "elevated" || cluster.riskLevel === "high"
                    ? "bg-accent-red"
                    : cluster.riskLevel === "medium"
                    ? "bg-accent-amber"
                    : "bg-text-muted"
                }`}
              />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function SelectedCluster({ cluster }: { cluster: MarketCluster }) {
  return (
    <div className="mt-2 space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[15px] font-semibold text-text-primary">
          {cluster.sector}
        </span>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          ×
        </span>
        <span
          className={`text-[15px] font-semibold ${
            cluster.region === "DACH" ? "text-accent-cyan" : "text-text-primary"
          }`}
        >
          {cluster.region}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="num text-3xl font-semibold text-accent-cyan">
          {cluster.averageHiringScore}
        </span>
        <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
          avg hiring score
        </span>
      </div>
      <LevelBar level={cluster.opportunityLevel} />
      <div className="grid grid-cols-2 gap-2 text-[11.5px]">
        <div>
          <div className="label-eyebrow">Companies</div>
          <div className="num text-text-primary">{cluster.companies}</div>
        </div>
        <div>
          <div className="label-eyebrow">Momentum</div>
          <div>
            <MomentumArrow
              trend={
                cluster.momentum > 8
                  ? "up"
                  : cluster.momentum < -2
                  ? "down"
                  : "flat"
              }
              value={cluster.momentum}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <OpportunityBadge level={cluster.opportunityLevel} />
        <RiskBadge level={cluster.riskLevel} />
      </div>
      <div>
        <div className="label-eyebrow mb-1">Dominant signals</div>
        <div className="flex flex-wrap gap-1">
          {cluster.dominantSignals.map((c) => (
            <span
              key={c}
              className="chip ring-bg-rule text-text-secondary bg-bg-surface/60"
            >
              {shortCategoryLabel(c)}
            </span>
          ))}
          {cluster.dominantSignals.length === 0 && (
            <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
              none
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
        roles momentum {formatPct(cluster.momentum)}
      </div>
    </div>
  );
}
