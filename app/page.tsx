"use client";

import { useEffect, useMemo, useState } from "react";
import { MarketOverviewHeader } from "@/components/MarketOverviewHeader";
import { IntelligenceSidebar } from "@/components/IntelligenceSidebar";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { BreakingNewsStrip } from "@/components/BreakingNewsStrip";
import { CommandPalette } from "@/components/CommandPalette";
import { StatusBar } from "@/components/StatusBar";
import { GermanyRegionPanel } from "@/components/GermanyRegionPanel";
import { MacroStrip } from "@/components/MacroStrip";
import { JobMarketPanel } from "@/components/JobMarketPanel";
import { MorningBriefCard } from "@/components/MorningBriefCard";
import { ResearchModal } from "@/components/ResearchModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useChord } from "@/lib/hotkeys";
import { FilterBar, type FilterState } from "@/components/FilterBar";
import { CompanySignalTable } from "@/components/CompanySignalTable";
import { CompanyDetailPanel } from "@/components/CompanyDetailPanel";
import { SignalTimeline } from "@/components/SignalTimeline";
import { ForecastPanel } from "@/components/ForecastPanel";
import { SectorIntelligencePanel } from "@/components/SectorIntelligencePanel";
import { RegionIntelligencePanel } from "@/components/RegionIntelligencePanel";
import { MarketClusterView } from "@/components/MarketClusterView";
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

function scrollToAnchor(anchor: string) {
  if (typeof window === "undefined") return;
  const el = document.getElementById(anchor);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openPaletteImperative() {
  // The CommandPalette toggles on Cmd+K via the global hotkey hub.
  // Synthesizing the event keeps the palette's state ownership in
  // one place.
  if (typeof window === "undefined") return;
  const isMac = /Mac/i.test(navigator.platform);
  const ev = new KeyboardEvent("keydown", {
    key: "k",
    metaKey: isMac,
    ctrlKey: !isMac,
    bubbles: true,
  });
  document.dispatchEvent(ev);
}

const SIGNAL_TYPE_LABELS: Array<{ id: string; label: string }> = [
  { id: "mna_buy", label: "M&A · Acquirer" },
  { id: "mna_sell", label: "M&A · Target" },
  { id: "funding_grant", label: "Funding / Grant" },
  { id: "job_spike", label: "Hiring spike" },
  { id: "employee_growth", label: "Headcount growth" },
  { id: "location_expansion", label: "Expansion" },
  { id: "new_business_unit", label: "New BU" },
  { id: "product_launch", label: "Product launch" },
  { id: "patent_filing", label: "Patent filing" },
  { id: "gf_change", label: "Leadership change" },
  { id: "restructuring", label: "Restructuring" },
  { id: "insolvency", label: "Insolvency" },
];

const SECTION_TARGETS: Array<{ id: string; label: string; anchor: string }> = [
  { id: "sectors", label: "Sector Trends", anchor: "section-overview" },
  { id: "regions", label: "Region Pulse", anchor: "section-sectors" },
  { id: "clusters", label: "Cluster Heatmap", anchor: "section-regions" },
  { id: "filter", label: "Filter Console", anchor: "section-clusters" },
  { id: "companies", label: "Company Radar", anchor: "section-companies" },
  { id: "forecast", label: "Forecast", anchor: "section-forecast" },
  { id: "timeline", label: "Signal Timeline", anchor: "section-timeline" },
];

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [researchQuery, setResearchQuery] = useState<string | null>(null);
  const user = useMemo(() => getSessionUser(), []);
  const sourcesOnline = useMemo(
    () => DATA_SOURCES.filter((s) => s.status === "live").length,
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const t0 = performance.now();
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
        setLatencyMs(performance.now() - t0);
        setLastSyncAt(new Date().toISOString());
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

  // Bloomberg-style chord navigation
  useChord("g s", () => scrollToAnchor("section-overview"));
  useChord("g r", () => scrollToAnchor("section-sectors"));
  useChord("g c", () => scrollToAnchor("section-regions"));
  useChord("g co", () => scrollToAnchor("section-companies"));
  useChord("g f", () => scrollToAnchor("section-forecast"));
  useChord("g t", () => scrollToAnchor("section-timeline"));

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
      <div className="pointer-events-none fixed inset-0 bg-grid bg-grid-fade opacity-40" />

      <div className="relative flex min-h-screen">
        <IntelligenceSidebar
          user={user}
          companies={data.companies}
          onSelectCompany={(id) => {
            setSelectedId(id);
            scrollToAnchor("section-companies");
          }}
          onOpenPalette={openPaletteImperative}
        />

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

          <ErrorBoundary section="Morning Brief">
            <MorningBriefCard
              watchlistCompanies={data.companies.map((c) => ({
                id: c.id,
                name: c.name,
              }))}
            />
          </ErrorBoundary>

          <ErrorBoundary section="Macro Strip">
            <MacroStrip />
          </ErrorBoundary>

          <ErrorBoundary section="Wire Feed">
            <BreakingNewsStrip />
          </ErrorBoundary>

          <main className="flex-1 px-5 py-6">
            {error && (
              <div className="mb-4 rounded-sm border border-accent-red/40 bg-accent-red/[0.06] px-3 py-2 font-mono text-[11px] text-accent-red">
                api error · {error}
              </div>
            )}

            <section id="section-overview" className="scroll-mt-24">
              <SectionTitle
                eyebrow="Sector Intelligence"
                title="Sector Trends · Hottest sectors"
                hint="signal volume × momentum × confidence"
              />
              {loading && data.sectors.length === 0 ? (
                <KpiSkeleton />
              ) : (
                <SectorIntelligencePanel sectors={data.sectors} />
              )}
            </section>

            <section id="section-sectors" className="mt-8 scroll-mt-24">
              <SectionTitle
                eyebrow="Region Intelligence"
                title="Regional Hiring Pulse"
                hint="dominant sectors · DE focus"
              />
              {loading && data.regions.length === 0 ? (
                <KpiSkeleton />
              ) : (
                <RegionIntelligencePanel regions={data.regions} />
              )}
            </section>

            <section id="section-de-regions" className="mt-8 scroll-mt-24">
              <SectionTitle
                eyebrow="Deutschland · Quadranten"
                title="Hiring Heat · Nord · Ost · Süd · West"
                hint="16 Bundesländer · live macro overlay · RSG Live Intel"
              />
              <ErrorBoundary section="Germany Quadrants">
                <GermanyRegionPanel />
              </ErrorBoundary>
            </section>

            <section id="section-regions" className="mt-8 scroll-mt-24">
              <SectionTitle
                eyebrow="Clusters"
                title="Sector × Region Heatmap"
                hint="opportunity / risk / dominant signals"
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
            </section>

            <section id="section-jobmarket" className="mt-8 scroll-mt-24">
              <SectionTitle
                eyebrow="Job Market"
                title="DE Job-Posting Pulse"
                hint="live · 12 Kategorien · refresh 30 min"
              />
              <ErrorBoundary section="Job Market">
                <JobMarketPanel />
              </ErrorBoundary>
            </section>

            <section id="section-clusters" className="mt-8 scroll-mt-24">
              <SectionTitle
                eyebrow="Query"
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
            </section>

            <section
              id="section-companies"
              className="mt-8 grid grid-cols-1 gap-5 scroll-mt-24 xl:grid-cols-[minmax(0,1fr)_460px]"
            >
              <div className="min-w-0 space-y-5">
                <div>
                  <SectionTitle
                    eyebrow="Companies"
                    title="Company Signal Radar"
                    hint="click to inspect"
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
                  eyebrow="Inspector"
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
            </section>

            <section id="section-forecast" className="mt-8 scroll-mt-24">
              <SectionTitle
                eyebrow="Forecast"
                title="Predicted Role Clusters · Forecast Window"
                hint="RSG Engine · forward forecast"
              />
              <ForecastPanel company={selected} />
            </section>

            <section id="section-timeline" className="mt-8 scroll-mt-24">
              <SectionTitle
                eyebrow="Temporal"
                title="Signal Timeline · 90 days"
                hint="aggregate event volume · negative-flag overlay"
              />
              <SignalTimeline companies={filtered} />
            </section>

            <footer className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-bg-border pt-6 font-mono text-2xs uppercase tracking-wider text-text-muted md:flex-row">
              <span>
                RSG · Market Intelligence Terminal · DE / DACH focus
              </span>
              <span className="text-text-faint">
                v1.0 · RSG Engine · live · read-only intelligence
              </span>
            </footer>
          </main>

          <StatusBar
            latencyMs={latencyMs}
            lastSyncAt={lastSyncAt}
            apiOk={!error}
          />
        </div>
      </div>

      <CommandPalette
        companies={data.companies}
        sections={SECTION_TARGETS}
        signalTypes={SIGNAL_TYPE_LABELS}
        onSelectCompany={(id) => {
          setSelectedId(id);
          scrollToAnchor("section-companies");
        }}
        onJumpToAnchor={(anchor) => scrollToAnchor(anchor)}
        onFilterBySignal={(signalType) => {
          setFilters((f) => ({
            ...f,
            category: signalType as FilterState["category"],
          }));
          scrollToAnchor("section-clusters");
        }}
        onResearchCompany={(query) => setResearchQuery(query)}
      />

      <ResearchModal query={researchQuery} onClose={() => setResearchQuery(null)} />
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
