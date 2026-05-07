"use client";

import { useEffect, useState } from "react";

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
  confidence: number;
  title?: string;
  source?: string;
  url?: string;
}

interface InsolvenzResp {
  ok: boolean;
  count: number;
  generatedAt: string;
  summary: {
    insolvencies: number;
    restructurings: number;
    byBundesland: Array<{ code: string; name: string; count: number }>;
  };
  data: InsolvenzItem[];
}

const SIGNAL_LABEL: Record<InsolvenzItem["signalType"], string> = {
  insolvency: "Insolvenz",
  restructuring: "Restructuring",
};

function daysLabel(d: number): string {
  if (d <= 0) return "heute";
  if (d === 1) return "1 Tag";
  return `${d} Tage`;
}

export function InsolvenzPulsePanel() {
  const [data, setData] = useState<InsolvenzResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/insolvenz-pulse", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as InsolvenzResp;
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

  const top = data?.data.slice(0, 8) ?? [];
  const empty = data && data.count === 0;

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Insolvenz · Restructuring · 30 Tage</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            {data
              ? `${data.summary.insolvencies} Insolvenzen · ${data.summary.restructurings} Restructurings`
              : "live · DACH"}
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          Outplacement · Restructuring Plays
        </span>
      </div>

      {error && (
        <div className="px-5 py-3 font-mono text-2xs uppercase tracking-terminal text-accent-red">
          api error · {error}
        </div>
      )}

      {!data && !error && (
        <div className="px-5 py-6 font-mono text-2xs uppercase tracking-terminal text-text-muted">
          loading insolvenz pulse…
        </div>
      )}

      {empty && (
        <div className="px-5 py-5">
          <div className="rounded-sm border border-dashed border-bg-line bg-bg-surface/40 p-4 text-[12.5px] text-text-secondary">
            <div className="font-semibold text-text-primary">
              Keine Insolvenzen oder Restructurings in den letzten 30 Tagen.
            </div>
            <div className="mt-1 text-text-muted">
              Sobald die Pipeline Bundesanzeiger / Wirtschaftspresse-Signale klassifiziert,
              erscheinen sie hier — nach Bundesland sortiert, mit Tageszahl seit Antrag.
            </div>
          </div>
        </div>
      )}

      {data && data.count > 0 && (
        <div className="grid grid-cols-1 gap-px border-b border-bg-border bg-bg-border lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="bg-bg-panel">
            <ul className="divide-y divide-bg-line/60">
              {top.map((it) => {
                const isInsolv = it.signalType === "insolvency";
                const tone = isInsolv ? "text-accent-red" : "text-accent-amber";
                const bgTone = isInsolv ? "bg-accent-red" : "bg-accent-amber";
                const inner = (
                  <div className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-bg-elevated/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${bgTone}`} />
                        <span className="truncate text-[13px] font-semibold text-text-primary">
                          {it.companyName}
                        </span>
                        {it.bundeslandCode && (
                          <span className="rounded-sm border border-bg-border bg-bg-surface px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-text-muted">
                            {it.bundeslandCode}
                          </span>
                        )}
                      </div>
                      {it.title && (
                        <div className="mt-0.5 truncate text-[12px] text-text-secondary">
                          {it.title}
                        </div>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-2xs uppercase tracking-wider text-text-faint">
                        <span className={tone}>{SIGNAL_LABEL[it.signalType]}</span>
                        <span>·</span>
                        <span>{it.industry}</span>
                        <span>·</span>
                        <span>{daysLabel(it.daysAgo)}</span>
                        {it.source && (
                          <>
                            <span>·</span>
                            <span className="truncate">{it.source}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`num text-[13px] font-semibold ${tone}`}>
                        {Math.round(Math.abs(it.impact))}
                      </div>
                      <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                        impact
                      </div>
                    </div>
                  </div>
                );
                return (
                  <li key={it.signalId}>
                    {it.url ? (
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {inner}
                      </a>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="bg-bg-panel p-4">
            <div className="label-eyebrow mb-2">Verdichtung · Bundesländer</div>
            {data.summary.byBundesland.length === 0 ? (
              <div className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
                keine Verdichtung
              </div>
            ) : (
              <ul className="space-y-1.5">
                {data.summary.byBundesland.slice(0, 8).map((b) => (
                  <li
                    key={b.code}
                    className="flex items-center justify-between text-[12.5px]"
                  >
                    <span className="flex items-center gap-2 truncate text-text-secondary">
                      <span className="rounded-sm border border-bg-border bg-bg-surface px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-text-muted">
                        {b.code}
                      </span>
                      <span className="truncate">{b.name}</span>
                    </span>
                    <span className="num font-semibold text-accent-red">
                      {b.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 border-t border-bg-border pt-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
              Goldmine · Outplacement · 30d window
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
