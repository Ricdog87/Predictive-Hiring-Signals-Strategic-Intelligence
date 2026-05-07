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

const STORAGE_KEY = "rsg.welcome.dismissed.v2";

/**
 * Compact one-line greeting. Dismissible — once closed it stays closed
 * across reloads. The market KPIs that used to live here are already
 * shown in the sticky tape above and the macro strip below.
 */
export function WelcomeBanner({
  user,
  overview,
  sourcesOnline,
  totalSources,
}: WelcomeBannerProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setHydrated(true);
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      /* private mode → just stay visible */
    }
  }, []);

  const greeting = useMemo(
    () => (now ? timeOfDayGreeting(now) : "Guten Tag"),
    [now]
  );

  const dateStamp = now ? formatLocalDate(now) : "";
  const allOnline = sourcesOnline === totalSources && totalSources > 0;

  if (!hydrated || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <section
      aria-label="Session welcome"
      className="flex items-center justify-between gap-3 border-b border-bg-border bg-bg-surface/80 px-5 py-1.5"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-2xs uppercase tracking-terminal">
        <span className="flex items-center gap-1.5">
          <span
            className={
              allOnline ? "text-accent-green" : "text-accent-amber"
            }
          >
            ●
          </span>
          <span className="text-text-secondary">
            {greeting},{" "}
            <span className="text-accent-cyan">{user.firstName}</span>
          </span>
        </span>
        {dateStamp && (
          <>
            <span className="text-text-faint">·</span>
            <span className="text-text-muted">{dateStamp}</span>
          </>
        )}
        <span className="text-text-faint">·</span>
        <span className="text-text-muted">
          {sourcesOnline}/{totalSources} feeds streaming
        </span>
        {overview && (
          <>
            <span className="text-text-faint">·</span>
            <span className="text-text-muted">
              ⌀ score{" "}
              <span className="text-accent-cyan">
                {overview.averageHiringScore.toFixed(1)}
              </span>
            </span>
            <span className="text-text-faint">·</span>
            <span className="text-text-muted">
              <span className="text-accent-green">
                {overview.newSignals24h}
              </span>{" "}
              new · 24h
            </span>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-sm border border-bg-border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-terminal text-text-muted hover:border-accent-cyan/40 hover:text-accent-cyan"
        aria-label="Dismiss greeting"
        title="Dismiss"
      >
        ×
      </button>
    </section>
  );
}

function formatLocalDate(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(d);
}
