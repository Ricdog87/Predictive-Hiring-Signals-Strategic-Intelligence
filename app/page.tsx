"use client";

import { useEffect, useMemo, useState } from "react";
import { MarketOverviewHeader } from "@/components/MarketOverviewHeader";
import { IntelligenceSidebar } from "@/components/IntelligenceSidebar";
import { WelcomeBanner } from "@/components/WelcomeBanner";
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
import { getSessionUser } from "@/lib/session";
import { DATA_SOURCES } from "@/lib/uiMockData";
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
  const user = useMemo(() => getSessionUser(), []);
  const sourcesOnline = useMemo(
    () => DATA_SOURCES.filter((s) => s.status === "live").length,
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        if (cancelled) return;
        const companies = toCompanyViews(aggregates);
        setData({ overview, sectors, regions, clusters, companies });
        setSelectedId((prev) =>
          prev && companies.some((c) => c.id === prev)
            ? prev
            : companies[0]?.id ?? null
        );
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        <IntelligenceSidebar user={user} />

        <div className="flex min-w-0 flex-1 flex-col">
          {data.overview ? (
            <MarketOverviewHeader overview={data.overview} user={user} />
          ) : (
            <div className="border-b border-bg-border bg-bg-surface px-5 py-3 font-mono text-2xs uppercase tracking-terminal text-text-muted">
              loading market overview…
            </div>
          )}

          <WelcomeBanner
            user={user}
            overview={data.overview}
            sourcesOnline={sourcesOnline}
            totalSources={DATA_SOURCES.length}
          />

          <main className="flex-1 px-5 py-6">
            {error && (
              <div className="mb-4 rounded-sm border border-accent-red/40 bg-accent-red/[0.06] px-3 py-2 font-mono text-[11px] text-accent-red">
                api error · {error}
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
                {loading && !selected ? (
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
              <ForecastPanel company={selected} />
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="08 · Temporal"
                title="Signal Timeline · 90 days"
                hint="aggregate event volume · negative-flag overlay"
              />
              <SignalTimeline companies={filtered} />
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="09 · System"
                title="Architecture Flow"
                hint="Sources → n8n → Hermes → Codex → Radar → MiroFish"
              />
              <ArchitectureFlow />
            </div>

            <footer className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-bg-border pt-6 font-mono text-2xs uppercase tracking-wider text-text-muted md:flex-row">
              <span>
                RSG · Market Intelligence Terminal · DE / DACH focus
              </span>
              <span className="text-text-faint">
                v1.0 · Codex backend · live API · read-only intelligence
              </span>
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
