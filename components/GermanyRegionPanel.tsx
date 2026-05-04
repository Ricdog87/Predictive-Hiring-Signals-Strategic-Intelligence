"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkline, syntheticSeries } from "./Sparkline";
import { AnimatedNumber } from "./AnimatedNumber";
import { signalTypeShortLabel } from "@/lib/marketIntelligence";
import type { Quadrant } from "@/lib/germanRegions";

interface BundeslandMetric {
  code: string;
  nuts: string;
  name: string;
  quadrant: Quadrant;
  population: number;
  companyCount: number;
  signalCount: number;
  positiveSignalCount: number;
  negativeSignalCount: number;
  averageHiringScore: number;
  netImpact: number;
  momentum30d: number;
  hiringRate: number;
  topSignalTypes: string[];
  lastObservedAt: string | null;
  leadCompanies: string[];
  unemploymentRate?: number | null;
  unemploymentPeriod?: string | null;
}

interface QuadrantMetric {
  id: Quadrant;
  label: string;
  bundeslandCount: number;
  companyCount: number;
  signalCount: number;
  averageHiringScore: number;
  netImpact: number;
  momentum30d: number;
  hiringRate: number;
  topSignalTypes: string[];
  population: number;
  bundeslaender: BundeslandMetric[];
}

interface RegionsResp {
  ok: boolean;
  quadrants: QuadrantMetric[];
  bundeslaender: BundeslandMetric[];
  unclassifiedCompanyCount: number;
  macro?: { source?: string; indicator?: string; available?: number; error?: string };
  generatedAt: string;
}

interface InsightResp {
  ok: boolean;
  fellBack?: boolean;
  reason?: string;
  insight?: {
    headline: string;
    narrative: string;
    drivers: string[];
    watchOuts: string[];
    rolesInDemand: string[];
    confidence: number;
  };
  citations?: string[];
  model?: string;
}

const QUADRANT_TONE: Record<Quadrant, string> = {
  nord: "from-accent-cyan/20 to-accent-cyan/0",
  ost: "from-accent-violet/20 to-accent-violet/0",
  sued: "from-accent-amber/20 to-accent-amber/0",
  west: "from-accent-green/20 to-accent-green/0",
};

const QUADRANT_LABEL: Record<Quadrant, string> = {
  nord: "Nord",
  ost: "Ost",
  sued: "Süd",
  west: "West",
};

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const min = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 36) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

export function GermanyRegionPanel() {
  const [data, setData] = useState<RegionsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant | "all">("all");
  const [selectedLand, setSelectedLand] = useState<BundeslandMetric | null>(null);
  const [insight, setInsight] = useState<InsightResp | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/regions/de", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as RegionsResp;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLands = useMemo(() => {
    if (!data) return [];
    if (activeQuadrant === "all") return data.bundeslaender;
    return data.bundeslaender.filter((b) => b.quadrant === activeQuadrant);
  }, [data, activeQuadrant]);

  async function loadInsight(target: BundeslandMetric | QuadrantMetric, scope: 'bundesland' | 'quadrant') {
    setInsight(null);
    setInsightLoading(true);
    try {
      const isLand = (t: BundeslandMetric | QuadrantMetric): t is BundeslandMetric =>
        (t as BundeslandMetric).code !== undefined;
      const body = isLand(target)
        ? {
            region: target.code,
            label: target.name,
            scope,
            context: {
              hiringRate: target.hiringRate,
              momentum: target.momentum30d,
              topSectors: target.topSignalTypes,
              topCompanies: target.leadCompanies,
              unemploymentRate: target.unemploymentRate ?? undefined,
            },
          }
        : {
            region: target.id,
            label: target.label,
            scope: 'quadrant' as const,
            context: {
              hiringRate: target.hiringRate,
              momentum: target.momentum30d,
              topSectors: target.topSignalTypes,
            },
          };
      const res = await fetch("/api/hermes/regional-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as InsightResp;
      setInsight(json);
    } catch (e) {
      setInsight({
        ok: false,
        reason: "network",
      });
    } finally {
      setInsightLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Deutschland · Hiring Heat</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            Quadranten · 16 Bundesländer · live
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
          {data?.macro?.indicator && (
            <span>Eurostat overlay · {data.macro.available} Länder</span>
          )}
          {error && <span className="text-accent-red">api · {error}</span>}
        </div>
      </div>

      {/* 4 quadrant tiles */}
      <div className="grid grid-cols-1 gap-px bg-bg-border md:grid-cols-2 xl:grid-cols-4 border-b border-bg-border">
        {(["nord", "ost", "sued", "west"] as Quadrant[]).map((qid) => {
          const q = data?.quadrants.find((x) => x.id === qid);
          const isActive = activeQuadrant === qid;
          return (
            <QuadrantTile
              key={qid}
              q={q}
              quadrantId={qid}
              isActive={isActive}
              onClick={() => {
                setActiveQuadrant(isActive ? "all" : qid);
                setSelectedLand(null);
              }}
              onInsight={() => q && loadInsight(q, 'quadrant')}
            />
          );
        })}
      </div>

      {/* Bundesland tile grid */}
      <div className="px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="label-eyebrow">
            {activeQuadrant === "all"
              ? `Bundesländer · alle 16`
              : `Bundesländer · ${QUADRANT_LABEL[activeQuadrant]}`}
          </span>
          {activeQuadrant !== "all" && (
            <button
              type="button"
              onClick={() => setActiveQuadrant("all")}
              className="font-mono text-2xs uppercase tracking-terminal text-text-muted hover:text-text-primary"
            >
              ← alle anzeigen
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8">
          {filteredLands.map((b) => (
            <LandTile
              key={b.code}
              b={b}
              selected={selectedLand?.code === b.code}
              onClick={() => {
                setSelectedLand(selectedLand?.code === b.code ? null : b);
                setInsight(null);
              }}
            />
          ))}
          {filteredLands.length === 0 && data && (
            <div className="col-span-full px-2 py-4 font-mono text-2xs uppercase tracking-terminal text-text-muted">
              keine Daten in diesem Quadranten
            </div>
          )}
        </div>
      </div>

      {/* Drill-down detail strip */}
      {selectedLand && (
        <LandDetail
          land={selectedLand}
          insight={insight}
          insightLoading={insightLoading}
          onLoadInsight={() => loadInsight(selectedLand, "bundesland")}
        />
      )}
    </div>
  );
}

function QuadrantTile({
  q,
  quadrantId,
  isActive,
  onClick,
  onInsight,
}: {
  q?: QuadrantMetric;
  quadrantId: Quadrant;
  isActive: boolean;
  onClick: () => void;
  onInsight: () => void;
}) {
  const tone = QUADRANT_TONE[quadrantId];
  const hot = (q?.hiringRate ?? 0) >= 60;
  return (
    <div
      className={`tilt-card relative cursor-pointer bg-bg-panel p-4 transition-all ${
        isActive ? "ring-2 ring-accent-cyan glow-cyan" : "ring-1 ring-bg-border"
      } ${hot ? "border-accent-cyan/40" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone}`}
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <div className="label-eyebrow">{QUADRANT_LABEL[quadrantId]}</div>
            <div className="mt-0.5 font-mono text-2xs uppercase tracking-wider text-text-muted">
              {q ? `${q.bundeslandCount} Länder · ${q.companyCount} Firmen` : "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInsight();
            }}
            className="rounded-sm border border-bg-border bg-bg-elevated px-1.5 py-0.5 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:border-accent-violet/40 hover:text-accent-violet"
            title="Hermes · Live insight"
          >
            ✦ AI
          </button>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <AnimatedNumber
              value={q?.hiringRate ?? 0}
              decimals={0}
              className="num text-3xl font-semibold text-accent-cyan"
            />
            <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
              hiring rate
            </span>
          </div>
          <Sparkline
            values={syntheticSeries(q?.hiringRate ?? 0, q?.momentum30d ?? 0, 22)}
            width={92}
            height={24}
            stroke={(q?.momentum30d ?? 0) >= 0 ? "#3A8841" : "#BE3C3C"}
            fill={
              (q?.momentum30d ?? 0) >= 0
                ? "rgba(58,136,65,0.10)"
                : "rgba(190,60,60,0.10)"
            }
          />
        </div>

        <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
          <div
            className="h-full bg-accent-cyan/80 transition-all duration-700 ease-out"
            style={{ width: `${Math.min(100, q?.hiringRate ?? 0)}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {(q?.topSignalTypes ?? []).slice(0, 3).map((t) => (
            <span
              key={t}
              className="chip ring-bg-rule text-text-secondary bg-bg-surface/60"
            >
              {signalTypeShortLabel(t)}
            </span>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
          <Mini label="Signale" value={(q?.signalCount ?? 0).toString()} />
          <Mini
            label="Avg score"
            value={Math.round(q?.averageHiringScore ?? 0).toString()}
          />
          <Mini
            label="Momentum"
            value={`${(((q?.momentum30d ?? 0) * 100)).toFixed(0)}%`}
            tone={(q?.momentum30d ?? 0) >= 0 ? "green" : "red"}
          />
        </div>
      </div>
    </div>
  );
}

function LandTile({
  b,
  selected,
  onClick,
}: {
  b: BundeslandMetric;
  selected: boolean;
  onClick: () => void;
}) {
  const intensity = Math.min(1, Math.max(0.05, b.hiringRate / 100));
  const tone =
    b.momentum30d >= 0.1
      ? `rgba(58,136,65,${intensity * 0.5})`
      : b.momentum30d <= -0.1
      ? `rgba(190,60,60,${intensity * 0.5})`
      : `rgba(14,107,133,${intensity * 0.45})`;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden rounded-sm border bg-bg-surface p-2 text-left transition-shadow ${
        selected
          ? "border-accent-cyan ring-1 ring-accent-cyan"
          : "border-bg-border hover:border-accent-cyan/40"
      }`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${tone}, transparent 70%)`,
      }}
      title={`${b.name} · ${b.companyCount} Firmen · ${b.signalCount} Signale`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-mono text-[10px] font-semibold tracking-wider text-text-secondary">
          {b.code}
        </span>
        <span className="num text-[14px] font-semibold text-text-primary">
          {Math.round(b.hiringRate)}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-text-secondary">
        {b.name}
      </div>
      <div className="mt-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-text-muted">
        <span>{b.companyCount}c</span>
        <span>{b.signalCount}s</span>
        {b.unemploymentRate != null && (
          <span title={`Eurostat ${b.unemploymentPeriod}`}>
            {b.unemploymentRate.toFixed(1)}%
          </span>
        )}
      </div>
    </button>
  );
}

function LandDetail({
  land,
  insight,
  insightLoading,
  onLoadInsight,
}: {
  land: BundeslandMetric;
  insight: InsightResp | null;
  insightLoading: boolean;
  onLoadInsight: () => void;
}) {
  return (
    <div className="border-t border-bg-border bg-bg-elevated/30 p-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label-eyebrow">{land.code} · {land.quadrant.toUpperCase()}</div>
          <div className="text-[16px] font-semibold text-text-primary">
            {land.name}
          </div>
          <div className="mt-0.5 font-mono text-2xs text-text-muted">
            {land.companyCount} Firmen · {land.signalCount} Signale ·{" "}
            {land.lastObservedAt
              ? `last seen ${relTime(land.lastObservedAt)} ago`
              : "no signals yet"}
          </div>
        </div>
        <button
          type="button"
          onClick={onLoadInsight}
          disabled={insightLoading}
          className="rounded-sm border border-bg-border bg-bg-panel px-2.5 py-1 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:border-accent-violet/40 hover:text-accent-violet disabled:opacity-50"
        >
          {insightLoading ? "fetching live insight…" : "✦ Live AI insight"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Hiring rate" value={Math.round(land.hiringRate).toString()} tone="cyan" />
        <Stat label="Avg score" value={Math.round(land.averageHiringScore).toString()} />
        <Stat
          label="Momentum 30d"
          value={`${(land.momentum30d * 100).toFixed(1)}%`}
          tone={land.momentum30d >= 0 ? "green" : "red"}
        />
        <Stat
          label="Arbeitslosenquote"
          value={
            land.unemploymentRate != null
              ? `${land.unemploymentRate.toFixed(1)}%`
              : "—"
          }
          sub={land.unemploymentPeriod ?? "Eurostat"}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="label-eyebrow mb-1">Top signal types</div>
          <div className="flex flex-wrap gap-1">
            {land.topSignalTypes.length === 0 ? (
              <span className="font-mono text-2xs text-text-muted">—</span>
            ) : (
              land.topSignalTypes.map((t) => (
                <span
                  key={t}
                  className="chip ring-bg-rule text-text-secondary bg-bg-surface/60"
                >
                  {signalTypeShortLabel(t)}
                </span>
              ))
            )}
          </div>
          <div className="label-eyebrow mb-1 mt-3">Lead companies</div>
          <div className="flex flex-wrap gap-1">
            {land.leadCompanies.length === 0 ? (
              <span className="font-mono text-2xs text-text-muted">—</span>
            ) : (
              land.leadCompanies.map((c) => (
                <span
                  key={c}
                  className="chip ring-accent-cyan/30 text-accent-cyan bg-accent-cyan/10"
                >
                  {c}
                </span>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="label-eyebrow mb-1 flex items-center gap-2">
            <span>Live insight</span>
            <span className="text-text-faint">·</span>
            <span className="text-accent-violet">Hermes / Sonar</span>
          </div>
          <InsightCard
            insight={insight}
            loading={insightLoading}
            placeholder={`Klick "Live AI insight" oben — Sonar (Perplexity via Hermes) holt aktuelle Quellen für ${land.name}.`}
          />
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  loading,
  placeholder,
}: {
  insight: InsightResp | null;
  loading: boolean;
  placeholder: string;
}) {
  if (loading) {
    return (
      <div className="rounded-sm border border-bg-border bg-bg-panel p-3 font-mono text-2xs uppercase tracking-terminal text-text-muted">
        ▸ querying live web · perplexity sonar…
      </div>
    );
  }
  if (!insight) {
    return (
      <div className="rounded-sm border border-dashed border-bg-line bg-bg-surface/40 p-3 text-[12.5px] text-text-muted">
        {placeholder}
      </div>
    );
  }
  if (!insight.ok || !insight.insight) {
    return (
      <div className="rounded-sm border border-accent-amber/40 bg-accent-amber/[0.06] p-3 text-[12.5px] text-accent-amber">
        {insight.reason === "unconfigured"
          ? "Hermes ist auf der Radar-Seite nicht konfiguriert (HERMES_BASE_URL fehlt). Sonar-Insights werden verfügbar, sobald Hermes erreichbar ist."
          : `live insight unavailable · ${insight.reason ?? "unknown"}`}
      </div>
    );
  }
  const i = insight.insight;
  return (
    <div className="rounded-sm border border-accent-violet/30 bg-accent-violet/[0.04] p-3">
      <div className="font-semibold text-text-primary">{i.headline}</div>
      <div className="mt-1 text-[12.5px] text-text-secondary leading-relaxed">
        {i.narrative}
      </div>
      {i.drivers && i.drivers.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12px] text-text-secondary">
          {i.drivers.slice(0, 5).map((d, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="text-accent-green">▸</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
      {i.rolesInDemand && i.rolesInDemand.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {i.rolesInDemand.slice(0, 6).map((r) => (
            <span
              key={r}
              className="chip ring-accent-cyan/30 text-accent-cyan bg-accent-cyan/10"
            >
              {r}
            </span>
          ))}
        </div>
      )}
      {insight.citations && insight.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-2xs uppercase tracking-terminal">
          <span className="text-text-muted">sources ·</span>
          {insight.citations.slice(0, 4).map((c, idx) => (
            <a
              key={idx}
              href={c}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-cyan hover:text-text-primary"
            >
              [{idx + 1}]
            </a>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between font-mono text-2xs uppercase tracking-terminal text-text-muted">
        <span>confidence · {Math.round((i.confidence ?? 0.5) * 100)}%</span>
        {insight.model && <span>{insight.model}</span>}
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  const fg =
    tone === "green"
      ? "text-accent-green"
      : tone === "red"
      ? "text-accent-red"
      : "text-text-primary";
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <div className={`num ${fg}`}>{value}</div>
    </div>
  );
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
  tone?: "cyan" | "green" | "red";
}) {
  const fg =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "green"
      ? "text-accent-green"
      : tone === "red"
      ? "text-accent-red"
      : "text-text-primary";
  return (
    <div className="rounded-sm border border-bg-border bg-bg-panel px-3 py-2">
      <div className="label-eyebrow truncate">{label}</div>
      <div className={`num mt-0.5 text-[18px] font-semibold ${fg}`}>{value}</div>
      {sub && (
        <div className="mt-0.5 font-mono text-2xs uppercase tracking-wider text-text-muted truncate">
          {sub}
        </div>
      )}
    </div>
  );
}
