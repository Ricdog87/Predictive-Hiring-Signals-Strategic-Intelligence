"use client";

import { useEffect, useMemo, useState } from "react";
import { MarketOverviewHeader } from "@/components/MarketOverviewHeader";
import { IntelligenceSidebar } from "@/components/IntelligenceSidebar";
import { FilterBar, type FilterState } from "@/components/FilterBar";
import { CompanySignalTable } from "@/components/CompanySignalTable";
import { CompanyDetailPanel } from "@/components/CompanyDetailPanel";
import { SignalTimeline } from "@/components/SignalTimeline";
import { ForecastPanel } from "@/components/ForecastPanel";
import { SectorIntelligencePanel } from "@/components/SectorIntelligencePanel";
import { RegionIntelligencePanel } from "@/components/RegionIntelligencePanel";
import { MarketClusterView } from "@/components/MarketClusterView";
import { ArchitectureFlow } from "@/components/ArchitectureFlow";
import {
  KpiSkeleton,
  TableSkeleton,
  InspectorSkeleton,
} from "@/components/LoadingSkeletons";
import {
  fetchCompanyAggregates,
  fetchMarketClusters,
  fetchMarketOverview,
  fetchRegionTrends,
  fetchSectorTrends,
} from "@/lib/marketIntelligence";
import { toCompanyViews, type CompanyView } from "@/lib/marketView";
import { emitToast } from "@/lib/toastBus";
import type {
  MarketCluster,
  MarketOverview,
  RegionTrend,
  SectorTrend,
} from "@/lib/uiContracts/market";

const INITIAL_FILTERS: FilterState = {
  search: "",
  industries: [],
  regions: [],
  minScore: 0,
  category: "all",
};

interface DashboardData {
  overview: MarketOverview | null;
  sectors: SectorTrend[];
  regions: RegionTrend[];
  clusters: MarketCluster[];
  companies: CompanyView[];
}

const EMPTY: DashboardData = {
  overview: null,
  sectors: [],
  regions: [],
  clusters: [],
  companies: [],
};

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);


  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [overview, sectors, regions, clusters, aggregates] =
        await Promise.all([
          fetchMarketOverview(),
          fetchSectorTrends(),
          fetchRegionTrends(),
          fetchMarketClusters(),
          fetchCompanyAggregates(),
        ]);
      const companies = toCompanyViews(aggregates);
      setData({ overview, sectors, regions, clusters, companies });
      setSelectedId((prev) =>
        prev && companies.some((c) => c.id === prev)
          ? prev
          : companies[0]?.id ?? null
      );
      setLastUpdated(new Date().toISOString());
      setError(null);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { const h = (e: Event) => setToast((e as CustomEvent<{message:string}>).detail.message); window.addEventListener("dashboard-toast", h as EventListener); return () => window.removeEventListener("dashboard-toast", h as EventListener); }, []);

  const sectorOptions = useMemo(
    () => data.sectors.map((s) => s.sector),
    [data.sectors]
  );
  const regionOptions = useMemo(
    () => data.regions.map((r) => r.region),
    [data.regions]
  );

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return data.companies.filter((c) => {
      if (
        filters.industries.length &&
        !filters.industries.includes(c.industry)
      )
        return false;
      if (filters.regions.length && !filters.regions.includes(c.region))
        return false;
      if (c.hiringScore < filters.minScore) return false;
      if (filters.category !== "all") {
        if (!c.signals.some((s) => s.signalType === filters.category))
          return false;
      }
      if (search) {
        const blob = `${c.name} ${c.id} ${c.industry} ${c.headquarters}`.toLowerCase();
        if (!blob.includes(search)) return false;
      }
      return true;
    });
  }, [data.companies, filters]);

  const selected =
    filtered.find((c) => c.id === selectedId) ??
    data.companies.find((c) => c.id === selectedId) ??
    null;

  const clearFilters = () => setFilters(INITIAL_FILTERS);

  return (
    <div className="relative min-h-screen bg-bg-base">
      <div className="pointer-events-none fixed inset-0 bg-grid bg-grid-fade opacity-60" />

      <div className="relative flex min-h-screen">
        <IntelligenceSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          {data.overview ? (
            <MarketOverviewHeader overview={data.overview} lastUpdated={lastUpdated ? new Date(lastUpdated).toISOString().slice(11,19)+" UTC" : undefined} onRefresh={async () => { const ok = await loadDashboard(); emitToast(ok ? "Refresh completed" : "Refresh failed"); }} onExportCsv={() => { const rows = filtered.map((c) => [c.name,c.industry,c.region,Math.round(c.hiringScore),c.hiringProbability,c.expectedHiringWindowDays].join(",")); const csv=["company,industry,region,hiringScore,hiringProbability,windowDays",...rows].join("\n"); const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="opportunities.csv"; a.click(); URL.revokeObjectURL(a.href);} } onExportJson={() => { const blob=new Blob([JSON.stringify(data.companies,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="company-intelligence.json"; a.click(); URL.revokeObjectURL(a.href);} } />
          ) : (
            <div className="border-b border-bg-border bg-bg-surface px-5 py-3 font-mono text-2xs uppercase tracking-terminal text-text-muted">
              loading market overview…
            </div>
          )}

          <main className="flex-1 px-5 py-5">
            {error && (
              <div className="mb-4 rounded-sm border border-accent-red/40 bg-accent-red/[0.06] px-3 py-2 font-mono text-[11px] text-accent-red">
                api error · {error}
              </div>
            )}

            {toast && (<div className="fixed right-6 top-20 z-40 rounded-sm border border-accent-cyan/40 bg-bg-panel px-3 py-2 font-mono text-2xs uppercase tracking-terminal text-accent-cyan">{toast}</div>)}

            {error && data.companies.length === 0 && !loading && (
              <div className="mb-6 rounded-md border border-bg-border bg-bg-panel p-6">
                <div className="font-mono text-2xs uppercase tracking-terminal text-text-muted">Dashboard fallback</div>
                <h2 className="mt-2 text-lg font-semibold">Live data is temporarily unavailable.</h2>
                <p className="mt-2 text-sm text-text-secondary">Please retry shortly. Existing API routes remain online and can be queried directly.</p>
              </div>
            )}

            <div>
              <SectionTitle
                eyebrow="01 · Sector Intelligence"
                title="Sector Trends · Hottest sectors"
                hint="GET /api/sectors · signal volume × momentum × confidence"
              />
              {loading && data.sectors.length === 0 ? (
                <KpiSkeleton />
              ) : (
                <SectorIntelligencePanel sectors={data.sectors} />
              )}
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="02 · Region Intelligence"
                title="Regional Hiring Pulse"
                hint="GET /api/regions · dominant sectors · DE focus"
              />
              {loading && data.regions.length === 0 ? (
                <KpiSkeleton />
              ) : (
                <RegionIntelligencePanel regions={data.regions} />
              )}
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="03 · Clusters"
                title="Sector × Region Heatmap"
                hint="GET /api/clusters · opportunity / risk / dominant signals"
              />
              {loading && data.clusters.length === 0 ? (
                <KpiSkeleton />
              ) : (
                <MarketClusterView
                  clusters={data.clusters}
                  sectors={sectorOptions}
                  regions={regionOptions}
                />
              )}
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="04 · Query"
                title="Filter Console"
                hint="Search · score floor · signal type · sector · region"
              />
              <FilterBar
                state={filters}
                onChange={setFilters}
                resultCount={filtered.length}
                totalCount={data.companies.length}
                sectorOptions={sectorOptions}
                regionOptions={regionOptions}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
              <div className="min-w-0 space-y-5">
                <div>
                  <SectionTitle
                    eyebrow="05 · Companies"
                    title="Company Signal Radar"
                    hint="GET /api/companies + /api/company/[id] · click to inspect"
                  />
                  {loading && data.companies.length === 0 ? (
                    <TableSkeleton />
                  ) : (
                    <CompanySignalTable
                      companies={filtered}
                      selectedId={selected?.id ?? null}
                      onSelect={(id) =>
                        setSelectedId((prev) => (prev === id ? null : id))
                      }
                      onClearFilters={clearFilters}
                    />
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <SectionTitle
                  eyebrow="06 · Inspector"
                  title="Company Detail"
                  hint="Hiring score · confidence · signal stream"
                />
                {loading ? (
                  <InspectorSkeleton />
                ) : (
                  <CompanyDetailPanel
                    company={selected}
                    onClose={() => setSelectedId(null)}
                  />
                )}
              </div>
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="07 · Forecast"
                title="Predicted Role Clusters · Forecast Window"
                hint="from /api/company/[id].latestPrediction"
              />
              {loading ? <KpiSkeleton /> : <ForecastPanel company={selected} />}
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="08 · Temporal"
                title="Signal Timeline · 90 days"
                hint="aggregate event volume · negative-flag overlay"
              />
              {loading ? <KpiSkeleton /> : <SignalTimeline companies={filtered} />}
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="09 · System"
                title="Architecture Flow"
                hint="Sources → n8n → Hermes → Codex → Radar → MiroFish"
              />
              {loading ? <KpiSkeleton /> : <ArchitectureFlow />}
            </div>

            <div className="mt-8 flex items-center justify-end">
              <a
                href="mailto:r.serrano@recruiting-sg.de?subject=Market%20Report%20Request"
                className="rounded-sm border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-2 font-mono text-2xs uppercase tracking-terminal text-accent-cyan hover:bg-accent-cyan/20"
              >
                Request Market Report
              </a>
            </div>

            <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-bg-border pt-6 font-mono text-2xs uppercase tracking-wider text-text-muted md:flex-row">
              <span>RSG · Market Intelligence Terminal · DE / DACH focus</span>
              <span className="text-text-faint">v1.0 · Codex backend · live API · read-only intelligence</span>
              <div className="flex items-center gap-3 text-text-secondary">
                <span>Impressum</span>
                <span>Datenschutz</span>
                <span>Terms</span>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div className="bracket-l pl-3">
        <div className="label-eyebrow">{eyebrow}</div>
        <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
      </div>
      {hint && (
        <span className="hidden font-mono text-2xs uppercase tracking-wider text-text-faint md:block">
          {hint}
        </span>
      )}
    </div>
  );
}
