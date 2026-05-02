"use client";

import type { MarketOverview } from "@/lib/uiContracts/market";
import { TEMPERATURE_STYLES } from "@/lib/uiDerivations";

interface MarketOverviewHeaderProps {
  overview: MarketOverview;
}

/**
 * Sticky top header that surfaces the Market Intelligence "tape": all the
 * fields exposed by GET /api/market-overview rendered as a 7-up density
 * strip. Designed to be glanceable in <2 seconds.
 */
export function MarketOverviewHeader({ overview }: MarketOverviewHeaderProps) {
  const t = TEMPERATURE_STYLES[overview.marketTemperature];
  return (
    <header className="sticky top-0 z-30 border-b border-bg-border bg-bg-base/90 backdrop-blur">
      <div className="flex h-12 items-center justify-between border-b border-bg-line/60 px-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-terminal">
            <span className="text-text-faint">RSG</span>
            <span className="text-text-faint">/</span>
            <span className="text-text-secondary">Market Intelligence</span>
            <span className="text-text-faint">/</span>
            <span className="text-accent-cyan">Hiring Radar</span>
          </div>
          <span className="hidden md:flex items-center gap-1.5 rounded-sm border border-bg-border bg-bg-panel px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-soft" />
            <span className="text-2xs font-mono uppercase tracking-terminal text-text-secondary">
              Read-only intelligence · Codex engine
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Meta label="UTC" value={utcNow()} />
          <Meta label="Market" value="DE · DACH" tone="cyan" />
          <Meta label="Engine" value="Codex · MI v1.0" />
          <Meta
            label="Temp"
            value={t.label.toUpperCase()}
            tone={
              overview.marketTemperature === "overheated" ? "violet" : "cyan"
            }
          />
          <button className="rounded-sm border border-bg-border bg-bg-panel px-2.5 py-1 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:text-text-primary">
            ⌘K · Search
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-bg-border bg-bg-panel font-mono text-2xs text-text-secondary">
            RD
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-bg-border md:grid-cols-4 xl:grid-cols-7">
        <Cell
          label="Total signals"
          value={overview.totalSignals.toLocaleString()}
          hint={`${overview.newSignals24h} new · 24h`}
        />
        <Cell
          label="High-prob. companies"
          value={overview.highProbabilityCompanies.toString()}
          hint="hiring score ≥ 70"
          tone="cyan"
        />
        <Cell
          label="Avg hiring score"
          value={overview.averageHiringScore.toString()}
          hint="across radar"
          tone="cyan"
        />
        <Cell
          label="Avg window"
          value={`${overview.averageHiringWindowDays}d`}
          hint="forecast median"
          tone="violet"
        />
        <Cell
          label="New · 24h"
          value={overview.newSignals24h.toString()}
          hint="company signals"
          tone="green"
        />
        <Cell
          label="Positive growth"
          value={overview.positiveGrowthSignals.toString()}
          hint="hiring · funding · expansion"
          tone="green"
          accentBar="bg-accent-green"
        />
        <Cell
          label="Negative risk"
          value={overview.negativeRiskSignals.toString()}
          hint="layoff / pivot"
          tone="red"
          accentBar="bg-accent-red"
        />
      </div>

      <Ticker overview={overview} />
    </header>
  );
}

function utcNow() {
  const d = new Date();
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function Meta({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "cyan" | "violet" | "green";
}) {
  const fg =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "violet"
      ? "text-accent-violet"
      : tone === "green"
      ? "text-accent-green"
      : "text-text-primary";
  return (
    <span className="hidden lg:flex items-baseline gap-1.5 text-2xs">
      <span className="font-mono uppercase tracking-terminal text-text-muted">
        {label}
      </span>
      <span className={`font-mono ${fg}`}>{value}</span>
    </span>
  );
}

function Cell({
  label,
  value,
  hint,
  tone,
  accentBar,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "cyan" | "violet" | "green" | "red";
  accentBar?: string;
}) {
  const fg =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "violet"
      ? "text-accent-violet"
      : tone === "green"
      ? "text-accent-green"
      : tone === "red"
      ? "text-accent-red"
      : "text-text-primary";
  return (
    <div className="relative bg-bg-panel px-4 py-2.5">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow truncate">{label}</span>
        <span className="text-2xs font-mono text-text-faint">live</span>
      </div>
      <div className={`num mt-1 text-[15px] font-semibold ${fg}`}>{value}</div>
      {hint && (
        <div className="text-2xs font-mono uppercase tracking-wider text-text-muted">
          {hint}
        </div>
      )}
      {accentBar && (
        <div className={`absolute inset-x-0 bottom-0 h-px ${accentBar}`} />
      )}
    </div>
  );
}

function Ticker({ overview }: { overview: MarketOverview }) {
  const items: [string, string, string][] = [
    ["DE · AI/ML", "AVG 78", "+22%"],
    ["DE · FINTECH", "AVG 64", "+12%"],
    ["DE · CLIMATE", "AVG 59", "+18%"],
    ["DE · CYBER", "AVG 71", "+09%"],
    ["DACH · HEALTH", "AVG 68", "+14%"],
    ["NORDICS · SAAS", "AVG 56", "+04%"],
    ["UK · AI/ML", "AVG 81", "+31%"],
    ["MARKET", `AVG ${overview.averageHiringScore}`, "+07%"],
    ["RISK", `${overview.negativeRiskSignals} signals`, "−"],
  ];
  const dup = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-t border-bg-border bg-bg-surface">
      <div className="flex animate-ticker whitespace-nowrap py-1.5">
        {dup.map(([k, v, d], i) => {
          const positive = !d.startsWith("−");
          return (
            <span
              key={i}
              className="mx-3 flex items-center gap-2 font-mono text-2xs uppercase tracking-wider"
            >
              <span className="text-text-secondary">{k}</span>
              <span className="text-accent-cyan">{v}</span>
              <span
                className={
                  positive ? "text-accent-green" : "text-accent-red"
                }
              >
                {d}
              </span>
              <span className="text-text-faint">·</span>
            </span>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-bg-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg-surface to-transparent" />
    </div>
  );
}
