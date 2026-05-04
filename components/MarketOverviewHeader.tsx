"use client";

import { useEffect, useState } from "react";
import type { MarketOverview } from "@/lib/uiContracts/market";
import {
  TEMPERATURE_STYLES,
  temperatureForScore,
} from "@/lib/marketIntelligence";
import type { SessionUser } from "@/lib/session";
import { AnimatedNumber } from "./AnimatedNumber";

interface MarketOverviewHeaderProps {
  overview: MarketOverview;
  user: SessionUser;
}

/**
 * Sticky top header that surfaces the Market Intelligence "tape": all the
 * fields exposed by GET /api/market-overview rendered as a 7-up density
 * strip. Designed to be glanceable in <2 seconds.
 */
export function MarketOverviewHeader({
  overview,
  user,
}: MarketOverviewHeaderProps) {
  const temp = temperatureForScore(overview.averageHiringScore);
  const t = TEMPERATURE_STYLES[temp];
  const { time, tz } = useLocalClock();
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
              RSG Engine · read-only intelligence
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Meta label={tz} value={time} />
          <Meta label="Market" value="DE · DACH" tone="cyan" />
          <Meta label="Engine" value="RSG · v1.0" />
          <Meta
            label="Temp"
            value={t.label.toUpperCase()}
            tone={temp === "overheated" ? "violet" : "cyan"}
          />
          <button className="rounded-sm border border-bg-border bg-bg-panel px-2.5 py-1 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:text-text-primary">
            ⌘K · Search
          </button>
          <a
            href="/admin/settings"
            className="rounded-sm border border-bg-border bg-bg-panel px-2.5 py-1 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:border-accent-cyan/40 hover:text-accent-cyan"
            title="Admin settings"
          >
            ⚙ Settings
          </a>
          <div
            className="flex h-7 items-center gap-2 rounded-sm border border-bg-border bg-bg-panel pl-2 pr-2.5"
            title={`${user.fullName} · ${user.role}`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-accent-cyan/15 font-mono text-2xs font-semibold text-accent-cyan">
              {user.initials}
            </span>
            <span className="hidden md:flex flex-col leading-none">
              <span className="font-mono text-[11px] text-text-primary">
                {user.fullName}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-terminal text-text-muted">
                {user.role}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-bg-border md:grid-cols-4 xl:grid-cols-7">
        <Cell
          label="Total signals"
          numericValue={overview.totalSignals}
          hint={`${overview.newSignals24h} new · 24h`}
        />
        <Cell
          label="High-prob. companies"
          numericValue={overview.highProbabilityCompanies}
          hint="hiring score ≥ 70"
          tone="cyan"
        />
        <Cell
          label="Avg hiring score"
          numericValue={overview.averageHiringScore}
          decimals={1}
          hint="across radar"
          tone="cyan"
        />
        <Cell
          label="Avg window"
          numericValue={overview.averageHiringWindowDays}
          suffix="d"
          hint="forecast median"
          tone="violet"
        />
        <Cell
          label="New · 24h"
          numericValue={overview.newSignals24h}
          hint="company signals"
          tone="green"
        />
        <Cell
          label="Positive growth"
          numericValue={overview.positiveGrowthSignals}
          hint="hiring · funding · expansion"
          tone="green"
          accentBar="bg-accent-green"
        />
        <Cell
          label="Negative risk"
          numericValue={overview.negativeRiskSignals}
          hint="layoff / pivot"
          tone="red"
          accentBar="bg-accent-red"
        />
      </div>

      <Ticker overview={overview} />
    </header>
  );
}

function useLocalClock(): { time: string; tz: string } {
  const [time, setTime] = useState("--:--:--");
  const [tz, setTz] = useState("LOCAL");
  useEffect(() => {
    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const city = resolved?.split("/").pop()?.replace(/_/g, " ") ?? "LOCAL";
      setTz(city);
    } catch {
      setTz("LOCAL");
    }
    const tick = () => {
      const d = new Date();
      setTime(
        new Intl.DateTimeFormat("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(d)
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return { time, tz };
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
  numericValue,
  decimals = 0,
  suffix,
  hint,
  tone,
  accentBar,
}: {
  label: string;
  value?: string;
  numericValue?: number;
  decimals?: number;
  suffix?: string;
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
    <div className="relative bg-bg-panel px-4 py-2.5 transition-colors hover:bg-bg-elevated/40">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow truncate">{label}</span>
        <span className="flex items-center gap-1 text-2xs font-mono text-text-faint">
          <span className="h-1 w-1 rounded-full bg-accent-green animate-pulse-soft" />
          live
        </span>
      </div>
      <div className={`mt-1 text-[15px] font-semibold ${fg}`}>
        {numericValue !== undefined ? (
          <AnimatedNumber
            value={numericValue}
            decimals={decimals}
            suffix={suffix}
            className="num"
          />
        ) : (
          <span className="num">{value}</span>
        )}
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

interface TickerItem {
  kind: 'signal' | 'macro' | 'news';
  primary: string;
  delta: string;
  tone: 'up' | 'down' | 'flat';
  detail?: string;
  source?: string;
  href?: string;
  breaking?: boolean;
}

interface TickerResp {
  ok: boolean;
  items: TickerItem[];
  count: number;
  macro?: {
    deUnemployment: { rate: number; period: string } | null;
  };
}

function Ticker({ overview }: { overview: MarketOverview }) {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/ticker', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as TickerResp;
        if (!cancelled && json.ok && json.items.length > 0) {
          setItems(json.items);
        }
      } catch {
        /* keep showing whatever we last had — pipeline must not break */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Always render *something* — when /api/ticker hasn't responded yet,
  // fall back to a single market-level pill so the strip isn't empty
  // on first paint.
  const display: TickerItem[] =
    items.length > 0
      ? items
      : [
          {
            kind: 'macro',
            primary: 'MARKET',
            delta: `AVG ${overview.averageHiringScore}`,
            tone: 'flat',
          },
        ];

  // Duplicate for the seamless marquee loop.
  const looped = [...display, ...display];

  return (
    <div className="relative overflow-hidden border-t border-bg-border bg-bg-surface">
      <div className="flex animate-ticker whitespace-nowrap py-1.5">
        {looped.map((it, i) => {
          const toneClass =
            it.tone === 'up'
              ? 'text-accent-green'
              : it.tone === 'down'
              ? 'text-accent-red'
              : 'text-accent-cyan';
          const arrow = it.tone === 'up' ? '▲' : it.tone === 'down' ? '▼' : '·';
          const inner = (
            <>
              {it.breaking && (
                <span className="flex h-1.5 w-1.5 items-center justify-center">
                  <span className="absolute inline-flex h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent-red opacity-75" />
                  <span className="relative inline-flex h-1 w-1 rounded-full bg-accent-red" />
                </span>
              )}
              <span className={`${toneClass} font-semibold`}>{arrow}</span>
              <span className="text-text-secondary">{it.primary}</span>
              <span className={toneClass}>{it.delta}</span>
              {it.source && (
                <span className="text-text-faint">· {it.source}</span>
              )}
              <span className="text-text-faint">·</span>
            </>
          );
          const className =
            'mx-3 flex items-center gap-2 font-mono text-2xs uppercase tracking-wider';
          if (it.href) {
            return (
              <a
                key={i}
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${className} hover:text-text-primary`}
                title={it.detail}
              >
                {inner}
              </a>
            );
          }
          return (
            <span key={i} className={className} title={it.detail}>
              {inner}
            </span>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-bg-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg-surface to-transparent" />
    </div>
  );
}
