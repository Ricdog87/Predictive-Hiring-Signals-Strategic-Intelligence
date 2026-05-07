"use client";

import { useEffect, useMemo, useState } from "react";
import { useWatchlist } from "@/lib/watchlist";
import type { CompanyView } from "@/lib/marketView";
import type { SectorTrend } from "@/lib/uiContracts/market";
import type { TabId } from "@/lib/uiMockData";

interface InsolvenzItem {
  signalId: string;
  companyId: string;
  companyName: string;
  industry: string;
  bundeslandCode: string | null;
  bundeslandName: string | null;
  signalType: "insolvency" | "restructuring";
  observedAt: string;
  daysAgo: number;
  impact: number;
  url?: string;
}

interface InsolvenzResp {
  ok: boolean;
  count: number;
  summary: {
    insolvencies: number;
    restructurings: number;
    byBundesland: Array<{ code: string; name: string; count: number }>;
  };
  data: InsolvenzItem[];
}

interface MoverRow {
  company: CompanyView;
  /** sum(impact * confidence) over the eligible window */
  thrust: number;
  /** dominant signalType in window */
  topSignal: string;
  /** count of signals in window */
  hits: number;
  /** "24h" or "7d" — which window the mover came from */
  window: "24h" | "7d";
}

const SIGNAL_LABEL: Record<string, string> = {
  mna_buy: "M&A · Acquirer",
  mna_sell: "M&A · Target",
  funding_grant: "Funding",
  job_spike: "Hiring spike",
  employee_growth: "Headcount ↑",
  location_expansion: "Expansion",
  new_business_unit: "New BU",
  product_launch: "Product",
  patent_filing: "Patent",
  gf_change: "Leadership Δ",
  restructuring: "Restructuring",
  insolvency: "Insolvenz",
  press_release: "Press",
};

interface TodayPanelProps {
  companies: CompanyView[];
  sectors: SectorTrend[];
  newSignals24h: number;
  onSwitchTab: (id: TabId) => void;
  onSelectCompany: (id: string) => void;
}

export function TodayPanel({
  companies,
  sectors,
  newSignals24h,
  onSwitchTab,
  onSelectCompany,
}: TodayPanelProps) {
  const { pinned } = useWatchlist();
  const [insolvenz, setInsolvenz] = useState<InsolvenzResp | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/insolvenz-pulse", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as InsolvenzResp;
        if (!cancelled) setInsolvenz(json);
      } catch {
        /* graceful — leave the strip empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Top movers (last 24h, fallback to 7d if data thin) ----------
  const movers: MoverRow[] = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const compute = (windowMs: number, label: "24h" | "7d"): MoverRow[] => {
      const cutoff = now - windowMs;
      const rows: MoverRow[] = [];
      for (const c of companies) {
        const recent = c.signals.filter(
          (s) => Date.parse(s.observedAt) >= cutoff
        );
        if (recent.length === 0) continue;
        const thrust = recent.reduce(
          (acc, s) => acc + s.impact * s.confidence,
          0
        );
        // Pick the highest |impact| signal as the headline
        const top = [...recent].sort(
          (a, b) =>
            Math.abs(b.impact * b.confidence) -
            Math.abs(a.impact * a.confidence)
        )[0];
        rows.push({
          company: c,
          thrust,
          topSignal: top.signalType,
          hits: recent.length,
          window: label,
        });
      }
      rows.sort((a, b) => Math.abs(b.thrust) - Math.abs(a.thrust));
      return rows;
    };
    let r = compute(day, "24h");
    if (r.length < 5) r = compute(7 * day, "7d");
    return r.slice(0, 5);
  }, [companies]);

  // ---------- Sector heat ----------
  const sectorHeat = useMemo(
    () =>
      [...sectors]
        .sort(
          (a, b) =>
            (b.momentum ?? 0) * (b.signalVolume ?? 0) -
            (a.momentum ?? 0) * (a.signalVolume ?? 0)
        )
        .slice(0, 4),
    [sectors]
  );

  // ---------- Insolvenz spotlight (last 7d) ----------
  const insolvSpotlight: InsolvenzItem[] = useMemo(() => {
    const items = insolvenz?.data ?? [];
    return items.filter((i) => i.daysAgo <= 7).slice(0, 3);
  }, [insolvenz]);

  // ---------- KPI cards ----------
  const watchlistCount = pinned.length;
  const highConvictionCount = useMemo(
    () => companies.filter((c) => c.hiringScore >= 70).length,
    [companies]
  );
  const insolvenz30d = insolvenz?.count ?? 0;
  const insolvenz7d = useMemo(
    () => (insolvenz?.data ?? []).filter((i) => i.daysAgo <= 7).length,
    [insolvenz]
  );

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-bg-border bg-bg-border md:grid-cols-4">
        <KpiCard
          label="Neue Signale · 24h"
          value={newSignals24h}
          tone="cyan"
          hint="news + discovery"
          onClick={() => onSwitchTab("companies")}
        />
        <KpiCard
          label="High-conviction"
          value={highConvictionCount}
          tone="violet"
          hint="hiring score ≥ 70"
          onClick={() => onSwitchTab("companies")}
        />
        <KpiCard
          label="Insolvenz · 7d"
          value={insolvenz7d}
          tone="red"
          hint={`${insolvenz30d} insgesamt · 30d`}
          onClick={() => onSwitchTab("insolvenz")}
        />
        <KpiCard
          label="Watchlist"
          value={watchlistCount}
          tone="green"
          hint={
            watchlistCount === 0
              ? "Pinne Companies via ★"
              : "pinned · sync to dashboard"
          }
          onClick={() => onSwitchTab("companies")}
        />
      </div>

      {/* Movers + Insolvenz */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <span className="label-eyebrow">Top Movers</span>
              <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
                {movers.length > 0
                  ? `letzte ${movers[0]!.window}`
                  : "live · 24h"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab("companies")}
              className="font-mono text-2xs uppercase tracking-terminal text-accent-cyan hover:underline"
            >
              alle Companies →
            </button>
          </div>
          {movers.length === 0 ? (
            <EmptyState
              line1="Heute noch keine neuen Movers."
              line2="Wirf einen Blick auf Companies oder Insolvenz."
            />
          ) : (
            <ul className="divide-y divide-bg-line/60">
              {movers.map((m) => {
                const isNeg = m.thrust < 0;
                const tone = isNeg ? "text-accent-red" : "text-accent-green";
                const arrow = isNeg ? "▼" : "▲";
                return (
                  <li key={m.company.id}>
                    <button
                      type="button"
                      onClick={() => onSelectCompany(m.company.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-elevated/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-[11px] ${tone}`}>
                            {arrow}
                          </span>
                          <span className="truncate text-[13px] font-semibold text-text-primary">
                            {m.company.name}
                          </span>
                          <span className="rounded-sm border border-bg-border bg-bg-surface px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-text-muted">
                            {m.company.region}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
                          <span className={tone}>
                            {SIGNAL_LABEL[m.topSignal] ?? m.topSignal}
                          </span>
                          <span>·</span>
                          <span>{m.company.industry}</span>
                          {m.hits > 1 && (
                            <>
                              <span>·</span>
                              <span>{m.hits} Signale</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={`num text-[14px] font-semibold ${
                            m.company.hiringScore >= 70
                              ? "text-accent-green"
                              : m.company.hiringScore >= 50
                              ? "text-accent-cyan"
                              : "text-text-secondary"
                          }`}
                        >
                          {Math.round(m.company.hiringScore)}
                        </div>
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                          score
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <span className="label-eyebrow">Insolvenz · 7d</span>
              <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
                Outplacement Plays
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab("insolvenz")}
              className="font-mono text-2xs uppercase tracking-terminal text-accent-cyan hover:underline"
            >
              alle ({insolvenz30d}) →
            </button>
          </div>
          {!insolvenz ? (
            <div className="px-4 py-6 font-mono text-2xs uppercase tracking-terminal text-text-muted">
              loading…
            </div>
          ) : insolvSpotlight.length === 0 ? (
            <EmptyState
              line1="Keine Insolvenzen letzte 7 Tage."
              line2={`30d-Fenster: ${insolvenz30d} Treffer.`}
            />
          ) : (
            <ul className="divide-y divide-bg-line/60">
              {insolvSpotlight.map((it) => {
                const isInsolv = it.signalType === "insolvency";
                const tone = isInsolv ? "text-accent-red" : "text-accent-amber";
                return (
                  <li key={it.signalId}>
                    <a
                      href={it.url || "#"}
                      target={it.url ? "_blank" : undefined}
                      rel={it.url ? "noopener noreferrer" : undefined}
                      onClick={(e) => {
                        if (!it.url) {
                          e.preventDefault();
                          onSwitchTab("insolvenz");
                        }
                      }}
                      className="block px-4 py-3 hover:bg-bg-elevated/40"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[11px] ${tone}`}>
                          ●
                        </span>
                        <span className="truncate text-[13px] font-semibold text-text-primary">
                          {it.companyName}
                        </span>
                        {it.bundeslandCode && (
                          <span className="rounded-sm border border-bg-border bg-bg-surface px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-text-muted">
                            {it.bundeslandCode}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
                        <span className={tone}>
                          {isInsolv ? "Insolvenz" : "Restructuring"}
                        </span>
                        <span>·</span>
                        <span>{it.industry}</span>
                        <span>·</span>
                        <span>
                          {it.daysAgo === 0
                            ? "heute"
                            : `${it.daysAgo}d`}
                        </span>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Sector heat + Watchlist */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <span className="label-eyebrow">Sektor-Heat</span>
              <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
                Top climbing
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab("sectors")}
              className="font-mono text-2xs uppercase tracking-terminal text-accent-cyan hover:underline"
            >
              Macro-Tab →
            </button>
          </div>
          {sectorHeat.length === 0 ? (
            <EmptyState line1="Keine Sektor-Daten verfügbar." />
          ) : (
            <div className="grid grid-cols-2 gap-px bg-bg-border md:grid-cols-4">
              {sectorHeat.map((s) => {
                const momentum = s.momentum ?? 0;
                const tone =
                  momentum > 0
                    ? "text-accent-green"
                    : momentum < 0
                    ? "text-accent-red"
                    : "text-text-secondary";
                return (
                  <button
                    key={s.sector}
                    type="button"
                    onClick={() => onSwitchTab("sectors")}
                    className="bg-bg-panel px-4 py-3 text-left transition-colors hover:bg-bg-elevated/40"
                  >
                    <div className="label-eyebrow truncate">{s.sector}</div>
                    <div className={`num mt-1 text-[18px] font-semibold ${tone}`}>
                      {momentum > 0 ? "+" : ""}
                      {Math.round(momentum)}
                    </div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                      {s.signalVolume ?? 0} Signale
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <span className="label-eyebrow">Watchlist</span>
              <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
                {watchlistCount} pinned
              </span>
            </div>
          </div>
          {watchlistCount === 0 ? (
            <EmptyState
              line1="Watchlist ist leer."
              line2="Pinne Companies via ★ in der Tabelle."
            />
          ) : (
            <ul className="divide-y divide-bg-line/60">
              {pinned
                .map((id) => companies.find((c) => c.id === id))
                .filter((c): c is CompanyView => Boolean(c))
                .slice(0, 6)
                .map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSelectCompany(c.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-bg-elevated/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-text-primary">
                          {c.name}
                        </div>
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                          {c.industry} · {c.expectedHiringWindowDays}d window
                        </div>
                      </div>
                      <div
                        className={`num shrink-0 text-[13px] font-semibold ${
                          c.hiringScore >= 70
                            ? "text-accent-green"
                            : c.hiringScore >= 50
                            ? "text-accent-cyan"
                            : "text-text-secondary"
                        }`}
                      >
                        {Math.round(c.hiringScore)}
                      </div>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: "cyan" | "violet" | "green" | "red";
  onClick?: () => void;
}) {
  const fg =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "violet"
      ? "text-accent-violet"
      : tone === "green"
      ? "text-accent-green"
      : "text-accent-red";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group bg-bg-panel px-4 py-3 text-left transition-colors hover:bg-bg-elevated/50"
    >
      <div className="label-eyebrow flex items-center justify-between">
        <span className="truncate">{label}</span>
        <span className="font-mono text-2xs text-text-faint group-hover:text-accent-cyan">
          →
        </span>
      </div>
      <div className={`num mt-1 text-[24px] font-semibold leading-none ${fg}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-1 font-mono text-2xs uppercase tracking-wider text-text-muted">
          {hint}
        </div>
      )}
    </button>
  );
}

function EmptyState({ line1, line2 }: { line1: string; line2?: string }) {
  return (
    <div className="px-4 py-6">
      <div className="rounded-sm border border-dashed border-bg-line bg-bg-surface/40 p-4 text-[12.5px]">
        <div className="font-semibold text-text-primary">{line1}</div>
        {line2 && <div className="mt-1 text-text-muted">{line2}</div>}
      </div>
    </div>
  );
}
