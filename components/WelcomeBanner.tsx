"use client";

import { useEffect, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/session";
import { timeOfDayGreeting } from "@/lib/session";
import type { MarketOverview } from "@/lib/uiContracts/market";
import { quoteForDate } from "@/lib/salesQuotes";

interface WelcomeBannerProps {
  user: SessionUser;
  overview: MarketOverview | null;
  sourcesOnline: number;
  totalSources: number;
}

/**
 * Hero-Greeting im Dashboard. Begrüsst den User namentlich, zeigt den
 * Live-Feed-Status und einen täglich rotierenden Vertriebs-Push.
 *
 * Der Spruch ist tagesstabil (`quoteForDate`) — derselbe ganzen Tag,
 * frisch am nächsten. Dismiss ist tagesbasiert: man kann ihn für heute
 * wegklicken, morgen kommt der nächste Push automatisch wieder.
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

  // Tagesbasierter Dismiss-Key — neuer Tag → neue Begrüssung,
  // unabhängig davon ob gestern weggeklickt wurde.
  const dismissKey = useMemo(
    () =>
      now
        ? `rsg.welcome.dismissed.${now.toISOString().slice(0, 10)}`
        : null,
    [now],
  );

  useEffect(() => {
    setHydrated(true);
    if (!dismissKey) return;
    try {
      if (window.localStorage.getItem(dismissKey) === "1") {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    } catch {
      /* private mode → just stay visible */
    }
  }, [dismissKey]);

  const greeting = useMemo(
    () => (now ? timeOfDayGreeting(now) : "Guten Tag"),
    [now],
  );
  const quote = useMemo(() => (now ? quoteForDate(now) : null), [now]);

  const dateStamp = now ? formatLocalDate(now) : "";
  const timeStamp = now ? formatLocalTime(now) : "";
  const allOnline = sourcesOnline === totalSources && totalSources > 0;

  if (!hydrated || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (!dismissKey) return;
    try {
      window.localStorage.setItem(dismissKey, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <section
      aria-label="Session welcome"
      className="relative border-b border-bg-border bg-gradient-to-r from-accent-cyan/[0.08] via-bg-surface/60 to-accent-violet/[0.06] px-5 py-5 md:px-8 md:py-6"
    >
      {/* faint terminal grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid bg-grid-32 opacity-30"
      />

      <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* ---- LEFT: greeting + status ------------------------------ */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-text-muted">
            <span
              aria-hidden
              className={
                allOnline
                  ? "h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-soft"
                  : "h-1.5 w-1.5 rounded-full bg-accent-amber animate-pulse-soft"
              }
            />
            <span>{allOnline ? "live · all feeds" : "partial · feeds"}</span>
            {dateStamp && (
              <>
                <span className="text-text-faint">·</span>
                <span>{dateStamp}</span>
              </>
            )}
            {timeStamp && (
              <>
                <span className="text-text-faint">·</span>
                <span className="num">{timeStamp}</span>
              </>
            )}
          </div>

          <h1 className="mt-2 text-[28px] font-semibold leading-tight text-text-primary md:text-[34px]">
            {greeting},{" "}
            <span className="text-accent-cyan">{user.firstName}</span>.
          </h1>

          <p className="mt-1 font-mono text-2xs uppercase tracking-terminal text-text-muted">
            <span className="text-text-secondary">
              {sourcesOnline}/{totalSources}
            </span>{" "}
            feeds streaming
            {overview && (
              <>
                <span className="px-2 text-text-faint">·</span>
                <span>
                  ⌀ score{" "}
                  <span className="num text-accent-cyan">
                    {overview.averageHiringScore.toFixed(1)}
                  </span>
                </span>
                <span className="px-2 text-text-faint">·</span>
                <span>
                  <span className="num text-accent-green">
                    {overview.newSignals24h}
                  </span>{" "}
                  new · 24h
                </span>
              </>
            )}
          </p>
        </div>

        {/* ---- RIGHT: daily sales push ------------------------------ */}
        {quote && (
          <figure className="relative overflow-hidden rounded-md border border-accent-cyan/30 bg-bg-panel/80 px-5 py-4 shadow-panel md:px-6 md:py-5">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent-cyan via-accent-cyan/60 to-accent-violet"
            />
            <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-accent-cyan">
              <span aria-hidden>✦</span>
              <span>Daily Push · Vertrieb</span>
              <span className="text-text-faint">·</span>
              <span className="text-text-muted">heute</span>
            </div>
            <blockquote className="mt-2 text-[20px] font-semibold leading-snug text-text-primary md:text-[22px]">
              <span className="select-none text-accent-cyan">“</span>
              {quote.text}
              <span className="select-none text-accent-cyan">”</span>
            </blockquote>
            {quote.context && (
              <figcaption className="mt-2 font-mono text-2xs uppercase tracking-terminal text-text-muted">
                — {quote.context}
              </figcaption>
            )}
          </figure>
        )}
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-sm border border-bg-border bg-bg-surface/80 px-1.5 py-0.5 font-mono text-2xs uppercase tracking-terminal text-text-muted hover:border-accent-cyan/40 hover:text-accent-cyan"
        aria-label="Begrüssung für heute schliessen"
        title="Für heute schliessen — morgen kommt der nächste Push"
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

function formatLocalTime(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
