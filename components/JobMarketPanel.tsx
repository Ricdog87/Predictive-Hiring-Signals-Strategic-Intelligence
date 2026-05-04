"use client";

import { useEffect, useMemo, useState } from "react";

interface PulseResp {
  ok: boolean;
  configured?: boolean;
  reason?: string;
  totalPostings?: number;
  byCategory?: Array<{ category: string; postings: number; meanSalary: number | null }>;
  topCompaniesAcross?: Array<{ name: string; postings: number }>;
  fetchedAt?: string;
  generatedAt?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  'it-jobs': 'IT',
  'engineering-jobs': 'Engineering',
  'sales-jobs': 'Sales',
  'finance-jobs': 'Finance',
  'manufacturing-jobs': 'Manufacturing',
  'logistics-warehouse-jobs': 'Logistik',
  'healthcare-nursing-jobs': 'Healthcare',
  'consultancy-jobs': 'Consultancy',
  'hr-jobs': 'HR',
  'creative-design-jobs': 'Creative',
  'energy-oil-gas-jobs': 'Energy',
  'scientific-qa-jobs': 'Scientific / QA',
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtSalary(n: number | null | undefined): string {
  if (!n || n <= 0) return '—';
  return `€${(n / 1000).toFixed(0)}k`;
}

export function JobMarketPanel() {
  const [data, setData] = useState<PulseResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/jobmarket/pulse', { cache: 'no-store' });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as PulseResp;
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

  const max = useMemo(
    () =>
      data?.byCategory && data.byCategory.length > 0
        ? Math.max(...data.byCategory.map((c) => c.postings))
        : 1,
    [data]
  );

  // When Adzuna isn't configured we render a clean placeholder rather
  // than disappearing the section — recruiters know the surface exists
  // and what flipping the env vars unlocks.
  const unconfigured = data && !data.ok && (data.reason === 'unconfigured' || data.configured === false);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">DE Job Market · Adzuna Pulse</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            {data?.ok ? `${fmt(data.totalPostings ?? 0)} offene Stellen · 12 Kategorien` : 'live · DE'}
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          GET /api/jobmarket/pulse
        </span>
      </div>

      {error && (
        <div className="px-5 py-3 font-mono text-2xs uppercase tracking-terminal text-accent-red">
          api error · {error}
        </div>
      )}

      {!data && !error && (
        <div className="px-5 py-6 font-mono text-2xs uppercase tracking-terminal text-text-muted">
          loading job market pulse…
        </div>
      )}

      {unconfigured && (
        <div className="px-5 py-5">
          <div className="rounded-sm border border-dashed border-bg-line bg-bg-surface/40 p-4 text-[12.5px] text-text-secondary">
            <div className="font-semibold text-text-primary">
              Adzuna ist auf der Radar-Seite (noch) nicht konfiguriert.
            </div>
            <div className="mt-1 text-text-muted">
              Setze <code className="font-mono text-accent-cyan">ADZUNA_APP_ID</code> +{' '}
              <code className="font-mono text-accent-cyan">ADZUNA_APP_KEY</code> auf Vercel — kostenlos via{' '}
              <a
                href="https://developer.adzuna.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-cyan hover:underline"
              >
                developer.adzuna.com
              </a>
              . Anschließend zeigt diese Section live: Stellenanzeigen-Volumen pro Kategorie, Median-Gehalt, Top-Arbeitgeber.
            </div>
          </div>
        </div>
      )}

      {data?.ok && data.byCategory && (
        <div className="grid grid-cols-1 gap-px border-b border-bg-border bg-bg-border lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-bg-panel">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-bg-border bg-bg-surface/40 text-left">
                  <Th>Kategorie</Th>
                  <Th align="right">Stellen</Th>
                  <Th align="right">Median Salary</Th>
                  <Th>Volumen</Th>
                </tr>
              </thead>
              <tbody>
                {data.byCategory.map((c) => {
                  const pct = (c.postings / max) * 100;
                  return (
                    <tr key={c.category} className="border-b border-bg-line/50 hover:bg-bg-elevated/40">
                      <td className="px-3 py-2 align-middle">
                        <div className="font-medium text-text-primary">
                          {CATEGORY_LABEL[c.category] ?? c.category}
                        </div>
                        <div className="font-mono text-2xs text-text-muted">{c.category}</div>
                      </td>
                      <td className="num px-3 py-2 text-right align-middle text-accent-cyan">
                        {fmt(c.postings)}
                      </td>
                      <td className="num px-3 py-2 text-right align-middle text-text-secondary">
                        {fmtSalary(c.meanSalary)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
                          <div
                            className="h-full bg-accent-cyan/80 transition-all duration-700 ease-out"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-bg-panel p-4">
            <div className="label-eyebrow mb-2">Top Arbeitgeber · gestern</div>
            <ul className="space-y-1.5">
              {(data.topCompaniesAcross ?? []).slice(0, 8).map((e) => (
                <li
                  key={e.name}
                  className="flex items-center justify-between text-[12.5px]"
                >
                  <span className="truncate text-text-secondary">{e.name}</span>
                  <span className="num font-semibold text-accent-cyan">
                    {fmt(e.postings)}
                  </span>
                </li>
              ))}
              {(data.topCompaniesAcross ?? []).length === 0 && (
                <li className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
                  keine Verdichtung
                </li>
              )}
            </ul>
            <div className="mt-3 border-t border-bg-border pt-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
              Quelle · Adzuna DE · refresh 30 min
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`label-eyebrow px-3 py-2.5 font-medium ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}
