"use client";

import { useEffect, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/session";
import { timeOfDayGreeting } from "@/lib/session";
import type { MarketOverview } from "@/lib/uiContracts/market";

interface WelcomeBannerProps {
  user: SessionUser;
  overview: MarketOverview | null;
  sourcesOnline: number;
  totalSources: number;
}

const BOOT_LINES = [
  "kernel · ingestion-pipeline ............. ok",
  "adapter · bundesanzeiger ................ live",
  "adapter · handelsregister ............... live",
  "engine  · codex / market-intelligence ... ok",
  "engine  · scoring v2.1.0 ................ ok",
  "feed    · ticker bound .................. ok",
];

/**
 * Futuristic on-load banner that slides in, runs a short boot sequence and
 * settles into a permanent greeting strip. Bloomberg-grade density on the
 * right (live UTC clock, market badges) — playful warmup on the left.
 */
export function WelcomeBanner({
  user,
  overview,
  sourcesOnline,
  totalSources,
}: WelcomeBannerProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [bootStep, setBootStep] = useState(0);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (bootStep >= BOOT_LINES.length) return;
    const t = setTimeout(() => setBootStep((s) => s + 1), 140);
    return () => clearTimeout(t);
  }, [bootStep]);

  const greeting = useMemo(
    () => (now ? timeOfDayGreeting(now) : "Guten Tag"),
    [now]
  );

  const localStamp = now ? formatLocalTime(now) : "—";
  const dateStamp = now ? formatLocalDate(now) : "—";
  const tzLabel = useMemo(getTimezoneLabel, []);

  const allOnline = sourcesOnline === totalSources && totalSources > 0;

  return (
    <section
      aria-label="Session welcome"
      className="relative overflow-hidden border-b border-bg-border bg-bg-surface animate-slide-down"
    >
      {/* faint scan sweep */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-accent-cyan/[0.06] to-transparent animate-scan-sweep"
        aria-hidden
      />
      {/* corner brackets */}
      <CornerBrackets />

      <div className="relative grid grid-cols-1 gap-px bg-bg-border lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="bg-bg-surface px-5 py-4">
          <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-accent-cyan animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan animate-pulse-soft" />
            <span>session · authenticated</span>
            <span className="text-text-faint">/</span>
            <span className="text-text-secondary">{user.role}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 animate-fade-in-up">
            <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">
              <span className="text-text-secondary">{greeting},</span>{" "}
              <span className="text-glow-cyan text-accent-cyan">
                {user.firstName}
              </span>
              <span className="ml-0.5 inline-block h-[18px] w-[8px] translate-y-[2px] bg-accent-cyan animate-cursor-blink align-baseline" />
            </h1>
            <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
              {dateStamp}
            </span>
          </div>

          <div
            className="mt-1 font-mono text-[12px] text-text-secondary animate-fade-in-up"
            style={{ animationDelay: "120ms" }}
          >
            <span
              className={
                allOnline ? "text-accent-green" : "text-accent-amber"
              }
            >
              {allOnline ? "▸ all systems online" : "▸ partial systems online"}
            </span>
            <span className="text-text-faint"> · </span>
            <span>
              {sourcesOnline}/{totalSources} feeds streaming
            </span>
            <span className="text-text-faint"> · </span>
            <span>codex engine ready</span>
            <span className="text-text-faint"> · </span>
            <span className="text-accent-violet">market · DACH</span>
          </div>

          {/* boot sequence */}
          <div className="mt-3 max-w-[640px]">
            <div className="relative h-1 overflow-hidden rounded-full bg-bg-elevated ring-1 ring-bg-border">
              <div className="absolute inset-y-0 left-0 animate-boot-fill rounded-full bg-gradient-to-r from-accent-cyan via-accent-violet to-accent-green" />
            </div>
            <ul className="mt-2 grid grid-cols-1 gap-y-0.5 font-mono text-[10.5px] uppercase tracking-wider text-text-muted sm:grid-cols-2">
              {BOOT_LINES.map((line, i) => {
                const done = i < bootStep;
                return (
                  <li
                    key={line}
                    className={`flex items-center gap-2 transition-opacity duration-300 ${
                      done ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <span className="text-accent-green">[ok]</span>
                    <span className="truncate">{line}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-2 bg-bg-surface lg:grid-cols-1 lg:divide-y lg:divide-bg-border">
          <Stat
            label={`Local · ${tzLabel}`}
            value={localStamp}
            sub="live · realtime"
            tone="cyan"
          />
          <Stat
            label="Hiring score · radar avg"
            value={
              overview ? overview.averageHiringScore.toFixed(1) : "—"
            }
            sub={
              overview
                ? `${overview.highProbabilityCompanies} high-prob · ≥ 70`
                : "awaiting data"
            }
            tone="violet"
          />
          <Stat
            label="Signals · 24h"
            value={
              overview ? overview.newSignals24h.toString() : "—"
            }
            sub={
              overview
                ? `${overview.totalSignals} total · ${overview.positiveGrowthSignals}↑ ${overview.negativeRiskSignals}↓`
                : "awaiting data"
            }
            tone="green"
          />
          <UnemploymentStat />
        </div>
      </div>
    </section>
  );
}

interface UnemploymentResp {
  ok: boolean;
  rate?: number;
  period?: string;
  source?: string;
  fetchedAt?: string;
}

function UnemploymentStat() {
  const [snap, setSnap] = useState<UnemploymentResp | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/macro/de-unemployment', {
          cache: 'force-cache',
        });
        if (!res.ok) return;
        const json = (await res.json()) as UnemploymentResp;
        if (!cancelled) setSnap(json);
      } catch {
        // graceful — leave the cell as awaiting
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value =
    snap?.ok && typeof snap.rate === 'number' ? `${snap.rate.toFixed(1)}%` : '—';
  const sub = snap?.ok && snap.period
    ? `🇩🇪 unemployment · ${snap.period}`
    : 'RSG Macro · monthly';
  return <Stat label="DE Arbeitslosenquote" value={value} sub={sub} tone="cyan" />;
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
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
    <div className="px-5 py-3">
      <div className="label-eyebrow flex items-center justify-between">
        <span className="truncate">{label}</span>
        <span className="text-text-faint">live</span>
      </div>
      <div className={`num mt-1 text-[20px] font-semibold leading-none ${fg}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-2xs uppercase tracking-wider text-text-muted">
          {sub}
        </div>
      )}
    </div>
  );
}

function CornerBrackets() {
  const cls =
    "pointer-events-none absolute h-3 w-3 border-accent-cyan/40";
  return (
    <>
      <span className={`${cls} left-0 top-0 border-l border-t`} />
      <span className={`${cls} right-0 top-0 border-r border-t`} />
      <span className={`${cls} bottom-0 left-0 border-b border-l`} />
      <span className={`${cls} bottom-0 right-0 border-b border-r`} />
    </>
  );
}

function formatLocalTime(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function formatLocalDate(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function getTimezoneLabel(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return "local";
    const city = tz.split("/").pop()?.replace(/_/g, " ");
    return city ?? tz;
  } catch {
    return "local";
  }
}
