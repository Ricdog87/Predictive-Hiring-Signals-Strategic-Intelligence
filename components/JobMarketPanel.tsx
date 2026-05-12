"use client";

import { useEffect, useMemo, useState } from "react";

type CategorySource = "BA" | "ADZUNA" | "UNAVAILABLE";

interface CategoryRow {
  category: string;
  postings: number;
  meanSalary: number | null;
  topCompanies?: Array<{ name: string; postings: number }>;
  topLocations?: Array<{ name: string; postings: number }>;
  source?: CategorySource;
  unavailable?: boolean;
}

interface PulseResp {
  ok: boolean;
  configured?: boolean;
  reason?: string;
  totalPostings?: number;
  byCategory?: CategoryRow[];
  topCompaniesAcross?: Array<{ name: string; postings: number }>;
  fetchedAt?: string;
  generatedAt?: string;
  okCount?: number;
  totalCategories?: number;
  sources?: {
    ba: "ok" | "partial" | "down";
    adzuna: "ok" | "partial" | "down" | "unconfigured";
  };
}

const CATEGORY_LABEL: Record<string, string> = {
  "it-jobs": "IT",
  "engineering-jobs": "Engineering",
  "sales-jobs": "Sales",
  "finance-jobs": "Finance",
  "accounting-finance-jobs": "Accounting",
  "legal-jobs": "Legal",
  "pr-advertising-marketing-jobs": "Marketing / PR",
  "retail-jobs": "Retail",
  "manufacturing-jobs": "Manufacturing",
  "logistics-warehouse-jobs": "Logistik",
  "healthcare-nursing-jobs": "Healthcare",
  "consultancy-jobs": "Consultancy",
  "hr-jobs": "HR",
  "creative-design-jobs": "Creative",
  "energy-oil-gas-jobs": "Energy",
  "scientific-qa-jobs": "Scientific / QA",
  "trade-construction-jobs": "Bau / Trade",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtSalary(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  return `€${(n / 1000).toFixed(0)}k`;
}

export function JobMarketPanel() {
  const [data, setData] = useState<PulseResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/jobmarket/pulse", { cache: "no-store" });
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
        ? Math.max(
            1,
            ...data.byCategory
              .filter((c) => !c.unavailable)
              .map((c) => c.postings),
          )
        : 1,
    [data],
  );

  // Surface is "unconfigured" only when neither source produced any data.
  const unconfigured =
    data && !data.ok && (data.reason === "unconfigured" || data.configured === false);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">DE Job Market · RSG Pulse</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            {data?.ok
              ? `${fmt(data.totalPostings ?? 0)} offene Stellen · ${
                  data.okCount ?? data.byCategory?.length ?? 0
                }/${data.totalCategories ?? data.byCategory?.length ?? 0} Kategorien`
              : "live · DE"}
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          live · refresh 6 h
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
              RSG Job Market liefert aktuell keine Daten.
            </div>
            <div className="mt-1 text-text-muted">
              Keine der angebundenen DACH-Job-Quellen ist erreichbar. Im
              Admin-Bereich (
              <a
                href="/admin/settings"
                className="text-accent-cyan hover:underline"
              >
                Settings
              </a>
              ) den Status prüfen.
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
                  <Th>Quelle</Th>
                </tr>
              </thead>
              <tbody>
                {data.byCategory.map((c) => {
                  const pct = c.unavailable ? 0 : (c.postings / max) * 100;
                  return (
                    <tr
                      key={c.category}
                      className={`border-b border-bg-line/50 hover:bg-bg-elevated/40 ${
                        c.unavailable ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-text-primary">
                            {CATEGORY_LABEL[c.category] ?? c.category}
                          </div>
                          {c.unavailable && (
                            <span
                              className="rounded-sm border border-bg-border bg-bg-surface px-1 font-mono text-[9px] uppercase tracking-wider text-text-muted"
                              title="Daten temporär nicht verfügbar"
                            >
                              n/a
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-2xs text-text-muted">
                          {c.category}
                        </div>
                      </td>
                      <td
                        className={`num px-3 py-2 text-right align-middle ${
                          c.unavailable ? "text-text-faint" : "text-accent-cyan"
                        }`}
                      >
                        {c.unavailable ? "—" : fmt(c.postings)}
                      </td>
                      <td className="num px-3 py-2 text-right align-middle text-text-secondary">
                        {c.unavailable ? "—" : fmtSalary(c.meanSalary)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
                          <div
                            className="h-full bg-accent-cyan/80 transition-all duration-700 ease-out"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <SourceBadge source={c.source ?? "UNAVAILABLE"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-bg-panel p-4">
            <div className="label-eyebrow mb-2">Top Arbeitgeber · DACH</div>
            <ul className="space-y-1.5">
              {(data.topCompaniesAcross ?? []).slice(0, 15).map((e) => (
                <li
                  key={e.name}
                  className="flex items-center justify-between gap-2 text-[12.5px]"
                >
                  <span
                    className="truncate text-text-secondary"
                    title={e.name}
                  >
                    {e.name}
                  </span>
                  <span className="num shrink-0 font-semibold text-accent-cyan">
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
              RSG Job Market · refresh 6 h
            </div>
          </div>
        </div>
      )}

      {data?.ok && (
        <div className="border-t border-bg-border px-5 py-2.5 font-mono text-2xs text-text-faint">
          DACH-Job-Quellen ·{" "}
          <SourceHealth label="primary" status={data.sources?.ba ?? "down"} />
          {" · "}
          <SourceHealth
            label="fallback"
            status={data.sources?.adzuna ?? "unconfigured"}
          />
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`label-eyebrow px-3 py-2.5 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function SourceBadge({ source }: { source: CategorySource }) {
  const tone =
    source === "BA"
      ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
      : source === "ADZUNA"
      ? "border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
      : "border-bg-border bg-bg-surface text-text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone}`}
      title={
        source === "BA"
          ? "DACH-Job-Quelle · primary"
          : source === "ADZUNA"
          ? "DACH-Job-Quelle · fallback"
          : "Quelle aktuell nicht verfügbar"
      }
    >
      {source === "UNAVAILABLE" ? "n/a" : source}
    </span>
  );
}

function SourceHealth({
  label,
  status,
}: {
  label: string;
  status: "ok" | "partial" | "down" | "unconfigured";
}) {
  const tone =
    status === "ok"
      ? "text-accent-green"
      : status === "partial"
      ? "text-accent-amber"
      : status === "down"
      ? "text-accent-red"
      : "text-text-faint";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-1 w-1 rounded-full ${tone.replace("text-", "bg-")}`} />
      <span>{label}</span>
      <span className={tone}>{status}</span>
    </span>
  );
}
