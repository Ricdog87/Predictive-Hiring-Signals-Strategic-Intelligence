"use client";

import { useEffect, useMemo, useState } from "react";
import { useWatchlist } from "@/lib/watchlist";

interface BriefResp {
  ok: boolean;
  fellBack?: boolean;
  reason?: string;
  detail?: string;
  brief?: {
    headline: string;
    summary: string;
    layoffPulse: Array<{
      company: string;
      headcount: number | null;
      context: string;
      source: string;
    }>;
    hiringPulse: Array<{
      company: string;
      context: string;
      source: string;
    }>;
    deals: Array<{
      type: 'M&A' | 'Funding' | 'Insolvency' | 'Spin-off';
      companies: string[];
      summary: string;
      source: string;
    }>;
    macroPulse: string;
    watchToday: string[];
    confidence: number;
  };
  citations?: string[];
  model?: string;
  generatedAt?: string;
}

interface CompanyLite {
  id: string;
  name: string;
}

interface MorningBriefCardProps {
  /** Companies the user has pinned — used to bias the brief. */
  watchlistCompanies?: CompanyLite[];
}

function formatHeadcount(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "";
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}${abs}`;
}

function relTime(iso: string | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const min = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 36) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function MorningBriefCard({ watchlistCompanies = [] }: MorningBriefCardProps) {
  const [data, setData] = useState<BriefResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { pinned } = useWatchlist();

  const watchlistCsv = useMemo(() => {
    const names = watchlistCompanies
      .filter((c) => pinned.includes(c.id))
      .map((c) => c.name)
      .filter(Boolean);
    return names.join(',');
  }, [watchlistCompanies, pinned]);

  const loadBrief = async () => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();
      params.set('role', 'Senior Recruiter / Talent Acquisition Lead');
      if (watchlistCsv) params.set('watchlist', watchlistCsv);
      const res = await fetch(`/api/intel/morning-brief?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as BriefResp;
      setData(json);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBrief();
    // refresh every 4h to keep the brief fresh during a long session
    const t = setInterval(loadBrief, 4 * 60 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistCsv]);

  if (!data && !error) {
    return (
      <section className="border-b border-bg-border bg-bg-surface px-5 py-4 font-mono text-2xs uppercase tracking-terminal text-text-muted">
        ▸ briefing wird recherchiert · sonar (perplexity) live web …
      </section>
    );
  }

  if (data && !data.ok) {
    return (
      <section className="border-b border-bg-border bg-bg-surface px-5 py-3">
        <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-amber animate-pulse-soft" />
          <span className="text-accent-amber font-semibold">Morning Brief</span>
          <span className="text-text-faint">·</span>
          <span className="text-text-secondary">
            {data.reason === 'unconfigured'
              ? 'aktiviert sich sobald Hermes erreichbar ist'
              : `live tier · ${data.reason ?? 'unavailable'}`}
          </span>
        </div>
      </section>
    );
  }

  const brief = data?.brief;
  if (!brief) return null;

  const layoffShown = brief.layoffPulse?.slice(0, expanded ? 7 : 4) ?? [];
  const hiringShown = brief.hiringPulse?.slice(0, expanded ? 5 : 3) ?? [];
  const dealsShown = brief.deals?.slice(0, expanded ? 4 : 2) ?? [];

  return (
    <section className="border-b border-bg-border bg-bg-surface">
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-3 border-b border-bg-line/60 px-5 py-2">
        <span className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-terminal">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-pulse-soft rounded-full bg-accent-violet opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-violet" />
          </span>
          <span className="text-accent-violet font-semibold">Morning Brief</span>
          <span className="text-text-faint">·</span>
          <span className="text-text-secondary">
            {brief.confidence !== undefined
              ? `${Math.round(brief.confidence * 100)}% conf`
              : 'live'}
          </span>
        </span>
        <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
          {data?.model?.replace(/^[^/]+\//, '') ?? 'sonar'}
          {data?.generatedAt && ` · ${relTime(data.generatedAt)}`}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {watchlistCsv && (
            <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
              watchlist · {watchlistCsv.split(',').length}
            </span>
          )}
          <button
            type="button"
            onClick={loadBrief}
            disabled={refreshing}
            className="rounded-sm border border-bg-border bg-bg-panel px-2 py-0.5 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:border-accent-violet/40 hover:text-accent-violet disabled:opacity-50"
            title="Briefing neu anfordern (live web)"
          >
            {refreshing ? '↻ recherchiert…' : '↻ refresh'}
          </button>
        </span>
      </div>

      {/* Headline + summary */}
      <div className="px-5 pt-4">
        <h2 className="text-[18px] font-semibold leading-tight text-text-primary">
          {brief.headline}
        </h2>
        <p className="mt-1.5 max-w-[780px] text-[13.5px] leading-relaxed text-text-secondary">
          {brief.summary}
        </p>
        {brief.macroPulse && (
          <p className="mt-1.5 max-w-[780px] font-mono text-[12px] text-text-muted">
            <span className="text-accent-cyan">▸ Makro</span> {brief.macroPulse}
          </p>
        )}
      </div>

      {/* Three-column body — Layoffs · Hiring · Deals */}
      <div className="grid grid-cols-1 gap-px bg-bg-border lg:grid-cols-3">
        <Column
          title="Stellenabbau heute"
          tone="red"
          empty="Keine Layoff-Headlines in den letzten 72h."
          items={layoffShown.map((l) => (
            <BriefRow
              key={`${l.company}-${l.context}`}
              tone="red"
              accent={formatHeadcount(l.headcount)}
              company={l.company}
              context={l.context}
              source={l.source}
            />
          ))}
        />
        <Column
          title="Stellenaufbau / Expansion"
          tone="green"
          empty="Keine Hiring-Headlines in den letzten 72h."
          items={hiringShown.map((h) => (
            <BriefRow
              key={`${h.company}-${h.context}`}
              tone="green"
              accent="▲"
              company={h.company}
              context={h.context}
              source={h.source}
            />
          ))}
        />
        <Column
          title="Deals · M&A · Funding"
          tone="violet"
          empty="Keine Deal-Headlines in den letzten 72h."
          items={dealsShown.map((d, i) => (
            <BriefRow
              key={`${d.type}-${i}`}
              tone="violet"
              accent={d.type}
              company={(d.companies ?? []).join(' / ') || d.type}
              context={d.summary}
              source={d.source}
            />
          ))}
        />
      </div>

      {/* Watch Today + expand */}
      {brief.watchToday && brief.watchToday.length > 0 && (
        <div className="px-5 py-3 border-t border-bg-border bg-bg-elevated/30">
          <div className="label-eyebrow mb-1.5">Heute beobachten</div>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {brief.watchToday.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[12.5px] text-text-secondary"
              >
                <span className="text-accent-cyan mt-0.5">▸</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer · sources + expand toggle */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-2 border-t border-bg-line/60 font-mono text-2xs uppercase tracking-terminal text-text-muted">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-text-secondary hover:text-text-primary"
        >
          {expanded ? '↑ kompakter' : '↓ mehr anzeigen'}
        </button>
        {data?.citations && data.citations.length > 0 && (
          <>
            <span className="text-text-faint">·</span>
            <span>quellen</span>
            {data.citations.slice(0, 6).map((c, i) => (
              <a
                key={i}
                href={c}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-cyan hover:text-text-primary"
              >
                [{i + 1}]
              </a>
            ))}
          </>
        )}
        {error && (
          <>
            <span className="text-text-faint">·</span>
            <span className="text-accent-red">err · {error}</span>
          </>
        )}
      </div>
    </section>
  );
}

function Column({
  title,
  tone,
  empty,
  items,
}: {
  title: string;
  tone: 'red' | 'green' | 'violet';
  empty: string;
  items: React.ReactNode[];
}) {
  const ringTone =
    tone === 'red'
      ? 'border-l-accent-red/50'
      : tone === 'green'
      ? 'border-l-accent-green/50'
      : 'border-l-accent-violet/50';
  return (
    <div className={`bg-bg-panel border-l-2 ${ringTone}`}>
      <div className="px-4 py-2 border-b border-bg-border">
        <span
          className={`label-eyebrow ${
            tone === 'red'
              ? 'text-accent-red'
              : tone === 'green'
              ? 'text-accent-green'
              : 'text-accent-violet'
          }`}
        >
          {title}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-4 font-mono text-2xs uppercase tracking-terminal text-text-muted">
          {empty}
        </div>
      ) : (
        <ul className="divide-y divide-bg-line/50">{items}</ul>
      )}
    </div>
  );
}

function BriefRow({
  tone,
  accent,
  company,
  context,
  source,
}: {
  tone: 'red' | 'green' | 'violet';
  accent: string;
  company: string;
  context: string;
  source: string;
}) {
  const fg =
    tone === 'red'
      ? 'text-accent-red'
      : tone === 'green'
      ? 'text-accent-green'
      : 'text-accent-violet';
  return (
    <li className="flex items-start gap-3 px-4 py-2">
      {accent && (
        <span
          className={`num min-w-[44px] text-right text-[13px] font-semibold tabular-nums ${fg}`}
        >
          {accent}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-text-primary">{company}</div>
        {context && (
          <div className="text-[12px] leading-snug text-text-secondary">
            {context}
          </div>
        )}
        {source && (
          <div className="mt-0.5 font-mono text-2xs uppercase tracking-wider text-text-muted">
            {source}
          </div>
        )}
      </div>
    </li>
  );
}
