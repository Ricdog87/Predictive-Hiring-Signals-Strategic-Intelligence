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
  fetchCompanyIntelligence,
  fetchMarketClusters,
  fetchMarketOverview,
  fetchRegionTrends,
  fetchSectorTrends,
  type CompanyIntelligenceResponse,
} from "@/lib/marketIntelligence";
import { toCompanyViews, type CompanyView } from "@/lib/marketView";
import { scrollToSection, useSearchShortcut } from "@/lib/uiHooks";
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
  useSearchShortcut();

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intelligence, setIntelligence] =
    useState<CompanyIntelligenceResponse | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [intelligenceError, setIntelligenceError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!selectedId) {
      setIntelligence(null);
      setIntelligenceError(null);
      setIntelligenceLoading(false);
      return;
    }
    let cancelled = false;
    setIntelligenceLoading(true);
    setIntelligenceError(null);
    fetchCompanyIntelligence(selectedId)
      .then((res) => {
        if (cancelled) return;
        setIntelligence(res);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setIntelligence(null);
        setIntelligenceError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIntelligenceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

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

  const toggleSectorFilter = (sector: string) => {
    setFilters((prev) => {
      const isOnlyThis =
        prev.industries.length === 1 && prev.industries[0] === sector;
      return {
        ...prev,
        industries: isOnlyThis ? [] : [sector],
      };
    });
    scrollToSection("section-companies");
  };

  const toggleRegionFilter = (region: string) => {
    setFilters((prev) => {
      const isOnlyThis = prev.regions.length === 1 && prev.regions[0] === region;
      return {
        ...prev,
        regions: isOnlyThis ? [] : [region],
      };
    });
    scrollToSection("section-companies");
  };

  const focusCluster = (cluster: MarketCluster) => {
    setFilters((prev) => {
      const sectorOnly =
        prev.industries.length === 1 && prev.industries[0] === cluster.sector;
      const regionOnly =
        prev.regions.length === 1 && prev.regions[0] === cluster.region;
      const alreadyTargeted = sectorOnly && regionOnly;
      return {
        ...prev,
        industries: alreadyTargeted ? [] : [cluster.sector],
        regions: alreadyTargeted ? [] : [cluster.region],
      };
    });
    scrollToSection("section-companies");
  };

  const selectedSector =
    filters.industries.length === 1 ? filters.industries[0] : null;
  const selectedRegion = filters.regions.length === 1 ? filters.regions[0] : null;

  return (
    <div className="relative min-h-screen bg-bg-base">
      <div className="pointer-events-none fixed inset-0 bg-grid bg-grid-fade opacity-60" />

      <div className="relative flex min-h-screen">
        <IntelligenceSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <section id="section-radar">
            {data.overview ? (
              <MarketOverviewHeader overview={data.overview} />
            ) : (
              <div className="border-b border-bg-border bg-bg-surface px-5 py-3 font-mono text-2xs uppercase tracking-terminal text-text-muted">
                loading market overview…
              </div>
            )}
          </section>

          <main className="flex-1 px-5 py-5">
            {error && (
              <div className="mb-4 rounded-sm border border-accent-red/40 bg-accent-red/[0.06] px-3 py-2 font-mono text-[11px] text-accent-red">
                api error · {error}
              </div>
            )}

            <section id="section-sectors" className="scroll-mt-24">
              <SectionTitle
                eyebrow="01 · Sector Intelligence"
                title="Sector Trends · Hottest sectors"
                hint="GET /api/sectors · click a sector to filter companies"
              />
              {loading && data.sectors.length === 0 ? (
                <KpiSkeleton />
              ) : (
                <SectorIntelligencePanel
                  sectors={data.sectors}
                  selectedSector={selectedSector}
                  onSelectSector={toggleSectorFilter}
                />
              )}
            </section>

            <section id="section-regions" className="mt-6 scroll-mt-24">
              <SectionTitle
                eyebrow="02 · Region Intelligence"
                title="Regional Hiring Pulse"
                hint="GET /api/regions · click a region to filter companies"
              />
              {loading && data.regions.length === 0 ? (
                <KpiSkeleton />
              ) : (
                <RegionIntelligencePanel
                  regions={data.regions}
                  selectedRegion={selectedRegion}
                  onSelectRegion={toggleRegionFilter}
                />
              )}
            </section>

            <section id="section-clusters" className="mt-6 scroll-mt-24">
              <SectionTitle
                eyebrow="03 · Clusters"
                title="Sector × Region Heatmap"
                hint="GET /api/clusters · click a cell to filter sector + region"
              />
              {loading && data.clusters.length === 0 ? (
                <KpiSkeleton />
              ) : (
                <MarketClusterView
                  clusters={data.clusters}
                  sectors={sectorOptions}
                  regions={regionOptions}
                  onSelectCluster={focusCluster}
                />
              )}
            </section>

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
                <section id="section-companies" className="scroll-mt-24">
                  <SectionTitle
                    eyebrow="05 · Companies"
                    title="Company Signal Radar"
                    hint="GET /api/companies + /api/company/[id] · click a row to inspect"
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
                </section>
              </div>
              <div className="min-w-0">
                <section id="section-signals" className="scroll-mt-24">
                  <SectionTitle
                    eyebrow="06 · Inspector"
                    title="Company Detail · Signals"
                    hint="GET /api/intelligence/[id] · 30/60/90 forecast · roles · why-now"
                  />
                  {loading && !selected ? (
                    <InspectorSkeleton />
                  ) : (
                    <CompanyDetailPanel
                      company={selected}
                      intelligence={intelligence}
                      intelligenceLoading={intelligenceLoading}
                      intelligenceError={intelligenceError}
                      onClose={() => setSelectedId(null)}
                    />
                  )}
                </section>
              </div>
            </div>

            <section id="section-forecast" className="mt-6 scroll-mt-24">
              <SectionTitle
                eyebrow="07 · Forecast"
                title="Predicted Role Clusters · Forecast Window"
                hint="from /api/company/[id].latestPrediction"
              />
              <ForecastPanel company={selected} />
            </section>

            <section id="section-timeline" className="mt-6 scroll-mt-24">
              <SectionTitle
                eyebrow="08 · Temporal"
                title="Signal Timeline · 90 days"
                hint="aggregate event volume · negative-flag overlay"
              />
              <SignalTimeline companies={filtered} />
            </section>

            <section id="section-flows" className="mt-6 scroll-mt-24">
              <SectionTitle
                eyebrow="09 · System"
                title="Architecture Flow"
                hint="Sources → n8n → Hermes → Codex → Radar → MiroFish"
              />
              <ArchitectureFlow />
            </section>

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
