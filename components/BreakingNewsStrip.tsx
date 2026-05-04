"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface NewsEntity {
  canonical: string;
  sector?: string;
  region?: string;
}

interface NewsItem {
  source: string;
  sourceLabel: string;
  title: string;
  link: string;
  publishedAt: string;
  ageHours: number;
  entity: NewsEntity;
  signalType: string;
  impact: number;
  confidence: number;
  breaking: boolean;
  corroboratingSources?: Array<{ source: string; link: string }>;
}

interface NewsResp {
  ok: boolean;
  items: NewsItem[];
  classifiedCount: number;
  rawCount: number;
  breakingCount: number;
  feeds: Array<{ source: string; label: string; itemCount: number; ok: boolean }>;
}

const SIGNAL_LABEL: Record<string, string> = {
  mna_buy: "M&A · Acquirer",
  mna_sell: "M&A · Target",
  gf_change: "Leadership Δ",
  patent_filing: "Patent",
  location_expansion: "Expansion",
  funding_grant: "Funding",
  press_release: "Press",
  restructuring: "Restructuring",
  insolvency: "Insolvency",
  job_spike: "Hiring spike",
  employee_growth: "Headcount Δ",
  product_launch: "Launch",
  new_business_unit: "New BU",
};

const POSITIVE = new Set([
  "mna_buy",
  "funding_grant",
  "job_spike",
  "employee_growth",
  "location_expansion",
  "new_business_unit",
  "product_launch",
  "patent_filing",
]);
const NEGATIVE = new Set(["insolvency", "restructuring", "mna_sell"]);

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMin = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 36) return `${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d`;
}

export function BreakingNewsStrip() {
  const [data, setData] = useState<NewsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seenLinksRef = useRef<Set<string>>(new Set());
  const [freshLinks, setFreshLinks] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/news/feed", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as NewsResp;
        if (!cancelled) {
          // Track which links are new since the last poll → highlight them.
          const incoming = new Set((json.items ?? []).map((i) => i.link));
          const fresh = new Set<string>();
          for (const lnk of incoming) {
            if (!seenLinksRef.current.has(lnk)) fresh.add(lnk);
          }
          // Skip the first load (don't highlight everything as new on mount).
          if (seenLinksRef.current.size > 0 && fresh.size > 0) {
            setFreshLinks(fresh);
            // Auto-clear the fresh marker after the highlight animation
            setTimeout(() => setFreshLinks(new Set()), 3500);
          }
          seenLinksRef.current = incoming;
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const top = useMemo(() => (data?.items ?? []).slice(0, 6), [data]);

  if (!data && !error) {
    return (
      <section className="border-b border-bg-border bg-bg-surface px-5 py-2.5 font-mono text-2xs uppercase tracking-terminal text-text-muted">
        loading wire feed…
      </section>
    );
  }

  if (error || top.length === 0) {
    return (
      <section className="border-b border-bg-border bg-bg-surface px-5 py-2.5">
        <div className="flex items-center gap-3 font-mono text-2xs uppercase tracking-terminal">
          <span className="flex items-center gap-1.5 text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
            wire feed
          </span>
          <span className="text-text-faint">
            {error
              ? `· upstream temporarily unreachable`
              : "· no classified items yet"}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-bg-border bg-bg-surface">
      <div className="flex items-center gap-3 px-5 py-2 border-b border-bg-line/60">
        <div className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-terminal">
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="absolute inline-flex h-2 w-2 animate-pulse-soft rounded-full bg-accent-red opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-red" />
          </span>
          <span className="text-accent-red font-semibold">Wire feed</span>
          <span className="text-text-faint">·</span>
          <span className="text-text-secondary">
            {data?.classifiedCount ?? 0} classified
          </span>
          {(data?.breakingCount ?? 0) > 0 && (
            <>
              <span className="text-text-faint">·</span>
              <span className="text-accent-red">
                {data?.breakingCount} breaking
              </span>
            </>
          )}
          <span className="text-text-faint">·</span>
          <span className="text-text-muted">
            {(data?.feeds ?? []).filter((f) => f.ok).length}/
            {(data?.feeds ?? []).length} sources live
          </span>
        </div>
      </div>
      <ul className="divide-y divide-bg-line/60">
        {top.map((n, i) => {
          const tone = POSITIVE.has(n.signalType)
            ? "text-accent-green"
            : NEGATIVE.has(n.signalType)
            ? "text-accent-red"
            : "text-accent-cyan";
          const arrow = POSITIVE.has(n.signalType)
            ? "▲"
            : NEGATIVE.has(n.signalType)
            ? "▼"
            : "·";
          const label = SIGNAL_LABEL[n.signalType] ?? n.signalType;
          const isFresh = freshLinks.has(n.link);
          return (
            <li key={i}>
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 px-5 py-1.5 transition-colors hover:bg-bg-elevated/40 ${
                  isFresh ? "animate-highlight-fade" : ""
                }`}
                title={n.title}
              >
                <span
                  className={`font-mono text-[11px] font-semibold ${tone} w-3 text-center`}
                >
                  {arrow}
                </span>
                {n.breaking && (
                  <span className="rounded-sm bg-accent-red/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-terminal text-accent-red ring-1 ring-accent-red/30">
                    EILMELDUNG
                  </span>
                )}
                <span className="font-mono text-2xs uppercase tracking-terminal text-accent-cyan whitespace-nowrap">
                  {n.entity.canonical}
                </span>
                <span className="text-text-faint">·</span>
                <span className={`font-mono text-2xs uppercase tracking-terminal ${tone} whitespace-nowrap`}>
                  {label}
                </span>
                <span className="text-text-faint">·</span>
                <span className="flex-1 truncate text-[12.5px] text-text-secondary">
                  {n.title}
                </span>
                <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted whitespace-nowrap">
                  {n.sourceLabel}
                </span>
                {(n.corroboratingSources ?? []).length > 0 && (
                  <span
                    className="rounded-sm bg-accent-cyan/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-terminal text-accent-cyan ring-1 ring-accent-cyan/30 whitespace-nowrap"
                    title={(n.corroboratingSources ?? [])
                      .map((c) => c.source)
                      .join(', ')}
                  >
                    +{(n.corroboratingSources ?? []).length} src
                  </span>
                )}
                <span className="font-mono text-2xs text-text-faint whitespace-nowrap">
                  {relTime(n.publishedAt)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
