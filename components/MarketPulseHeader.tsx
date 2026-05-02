"use client";

import {
  type MarketPulse,
  TEMPERATURE_STYLES,
} from "@/lib/uiDerivations";
import { formatPct } from "@/lib/format";

interface MarketPulseHeaderProps {
  pulse: MarketPulse;
}

export function MarketPulseHeader({ pulse }: MarketPulseHeaderProps) {
  const t = TEMPERATURE_STYLES[pulse.marketTemperature];

  return (
    <header className="sticky top-0 z-30 border-b border-bg-border bg-bg-base/90 backdrop-blur">
      <div className="flex h-12 items-center justify-between border-b border-bg-line/60 px-5">
        <div className="flex items-center gap-3">
          <Breadcrumb />
          <span className="hidden md:flex items-center gap-1.5 rounded-sm border border-bg-border bg-bg-panel px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-soft" />
            <span className="text-2xs font-mono uppercase tracking-terminal text-text-secondary">
              Read-only intelligence · mock dataset
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <UtcClock />
          <span className="hidden lg:flex h-3 w-px bg-bg-rule" />
          <MetaItem label="Region" value="GLOBAL" tone="cyan" />
          <span className="hidden lg:flex h-3 w-px bg-bg-rule" />
          <MetaItem label="Engine" value="Codex · PHS v1.0" />
          <span className="hidden lg:flex h-3 w-px bg-bg-rule" />
          <button className="rounded-sm border border-bg-border bg-bg-panel px-2.5 py-1 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:text-text-primary">
            ⌘K · Search
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-bg-border bg-bg-panel font-mono text-2xs text-text-secondary">
            RD
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-bg-border md:grid-cols-3 lg:grid-cols-6">
        <PulseCell
          label="Companies tracked"
          value={pulse.totalCompanies.toString()}
          hint="active radar"
        />
        <PulseCell
          label="Critical / Strong"
          value={`${pulse.criticalCount} / ${pulse.strongCount}`}
          hint="PHS ≥ 65"
          tone="violet"
        />
        <PulseCell
          label="Avg Hiring Score"
          value={pulse.avgScore.toString()}
          hint="0–100"
          tone="cyan"
        />
        <PulseCell
          label="Signals · 24h"
          value={pulse.signals24h.toString()}
          hint={`${pulse.signals90d} in 90d`}
          tone="green"
        />
        <PulseCell
          label="Top Mover"
          value={pulse.topMover.name}
          hint={formatPct(pulse.topMover.delta) + " · roles 30d"}
          tone="cyan"
          truncate
        />
        <PulseCell
          label="Market Temp."
          value={t.label}
          hint={`${pulse.predictedRoles90d} predicted roles · 90d`}
          tone={pulse.marketTemperature === "overheated" ? "violet" : "cyan"}
          accentBar={t.bar}
        />
      </div>
      <Ticker />
    </header>
  );
}

function Breadcrumb() {
  return (
    <div className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-terminal">
      <span className="text-text-faint">RSG</span>
      <span className="text-text-faint">/</span>
      <span className="text-text-secondary">Intelligence</span>
      <span className="text-text-faint">/</span>
      <span className="text-accent-cyan">Hiring Radar</span>
    </div>
  );
}

function UtcClock() {
  const d = new Date();
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return (
    <MetaItem label="UTC" value={`${hh}:${mm}`} mono />
  );
}

function MetaItem({
  label,
  value,
  tone,
  mono = true,
}: {
  label: string;
  value: string;
  tone?: "cyan" | "green";
  mono?: boolean;
}) {
  const valueColor =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "green"
      ? "text-accent-green"
      : "text-text-primary";
  return (
    <span className="hidden lg:flex items-baseline gap-1.5 text-2xs">
      <span className="font-mono uppercase tracking-terminal text-text-muted">
        {label}
      </span>
      <span className={`${mono ? "font-mono" : ""} ${valueColor}`}>{value}</span>
    </span>
  );
}

function PulseCell({
  label,
  value,
  hint,
  tone,
  accentBar,
  truncate,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "cyan" | "violet" | "green";
  accentBar?: string;
  truncate?: boolean;
}) {
  const valueColor =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "violet"
      ? "text-accent-violet"
      : tone === "green"
      ? "text-accent-green"
      : "text-text-primary";

  return (
    <div className="relative bg-bg-panel px-4 py-2.5">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">{label}</span>
        <span className="text-2xs font-mono text-text-faint">live</span>
      </div>
      <div
        className={`num mt-1 text-[15px] font-semibold ${valueColor} ${
          truncate ? "truncate" : ""
        }`}
      >
        {value}
      </div>
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

const TICKER_ITEMS: [string, string, string][] = [
  ["HELIX ROBOTICS", "PHS 84", "+38%"],
  ["VESPER HEALTH", "PHS 82", "+52%"],
  ["SKYFORGE AI", "PHS 91", "+60%"],
  ["RIVERMARK BIO", "PHS 78", "+41%"],
  ["QUANTA SECURE", "PHS 71", "+28%"],
  ["NORTHWIND PAY", "PHS 58", "+15%"],
  ["LUMEN COMMERCE", "PHS 31", "−12%"],
  ["PERISCOPE", "PHS 64", "+19%"],
  ["GRETA OPS", "PHS 49", "+12%"],
  ["COBALT BANKING", "PHS 38", "+04%"],
  ["ATLAS FREIGHT", "PHS 41", "+06%"],
  ["SOLIVIA ENERGY", "PHS 56", "+22%"],
];

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="relative overflow-hidden border-t border-bg-border bg-bg-surface">
      <div className="flex animate-ticker whitespace-nowrap py-1.5">
        {items.map(([name, score, delta], i) => {
          const positive = !delta.startsWith("−");
          return (
            <span
              key={i}
              className="mx-3 flex items-center gap-2 font-mono text-2xs uppercase tracking-wider"
            >
              <span className="text-text-secondary">{name}</span>
              <span className="text-accent-cyan">{score}</span>
              <span
                className={positive ? "text-accent-green" : "text-accent-red"}
              >
                {delta}
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
