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
import { InsolvenzPulsePanel } from "@/components/InsolvenzPulsePanel";
import { RegionIntelligencePanel } from "@/components/RegionIntelligencePanel";
import { MarketClusterView } from "@/components/MarketClusterView";
import { TodayPanel } from "@/components/TodayPanel";
import { StrategyLabPanel } from "@/components/strategy-lab";
import {
  DashboardTabs,
  readPersistedTab,
} from "@/components/DashboardTabs";
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
import { DATA_SOURCES, TAB_IDS, type TabId } from "@/lib/uiMockData";
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

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("today");
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

  // Hydrate persisted tab choice. ?tab=<id> in the URL wins over the
  // localStorage value (so /strategy-lab → ?tab=strategy-lab can deep-link).
  useEffect(() => {
    if (typeof window !== "undefined") {
      const queryTab = new URLSearchParams(window.location.search).get("tab");
      if (queryTab && (TAB_IDS as readonly string[]).includes(queryTab)) {
        setActiveTab(queryTab as TabId);
        return;
      }
    }
    const persisted = readPersistedTab();
    if (persisted) setActiveTab(persisted);
  }, []);

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

  // Bloomberg-style chord nav now switches tabs instead of scrolling.
  useChord("g t", () => setActiveTab("today"));
  useChord("g co", () => setActiveTab("companies"));
  useChord("g s", () => setActiveTab("sectors"));
  useChord("g i", () => setActiveTab("insolvenz"));
  useChord("g j", () => setActiveTab("jobs"));
  useChord("g f", () => setActiveTab("forecast"));
  useChord("g b", () => setActiveTab("briefing"));
  useChord("g l", () => setActiveTab("strategy-lab"));

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

  const tabCounts = useMemo(
    () => ({
      companies: data.companies.length,
    }),
    [data.companies.length]
  );

  return (
    <div className="relative min-h-screen bg-bg-base">
      <div className="pointer-events-none fixed inset-0 bg-grid bg-grid-fade opacity-40" />

      <div className="relative flex min-h-screen">
        <IntelligenceSidebar
          user={user}
          companies={data.companies}
          activeTab={activeTab}
          onSwitchTab={setActiveTab}
          onSelectCompany={(id) => {
            setSelectedId(id);
            setActiveTab("companies");
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

          <DashboardTabs
            active={activeTab}
            onChange={setActiveTab}
            counts={tabCounts}
          />

          <main className="flex-1 px-5 py-5">
            {error && (
              <div className="mb-4 rounded-sm border border-accent-red/40 bg-accent-red/[0.06] px-3 py-2 font-mono text-[11px] text-accent-red">
                api error · {error}
              </div>
            )}

            {/* TODAY TAB */}
            {activeTab === "today" && (
              <div role="tabpanel" id="panel-today">
                <ErrorBoundary section="Today">
                  <TodayPanel
                    companies={data.companies}
                    sectors={data.sectors}
                    newSignals24h={data.overview?.newSignals24h ?? 0}
                    onSwitchTab={setActiveTab}
                    onSelectCompany={(id) => {
                      setSelectedId(id);
                      setActiveTab("companies");
                    }}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* COMPANIES TAB */}
            {activeTab === "companies" && (
              <div role="tabpanel" id="panel-companies" className="space-y-5">
                <FilterBar
                  state={filters}
                  onChange={setFilters}
                  resultCount={filtered.length}
                  totalCount={data.companies.length}
                  sectorOptions={sectorOptions}
                  regionOptions={regionOptions}
                />
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
                  <div className="min-w-0 space-y-5">
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
                </div>
              </div>
            )}

            {/* MACRO TAB */}
            {activeTab === "sectors" && (
              <div role="tabpanel" id="panel-sectors" className="space-y-8">
                <section>
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
                <section>
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
                <section>
                  <SectionTitle
                    eyebrow="Deutschland · Quadranten"
                    title="Hiring Heat · Nord · Ost · Süd · West"
                    hint="16 Bundesländer · live macro overlay · RSG Live Intel"
                  />
                  <ErrorBoundary section="Germany Quadrants">
                    <GermanyRegionPanel />
                  </ErrorBoundary>
                </section>
                <section>
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
              </div>
            )}

            {/* INSOLVENZ TAB */}
            {activeTab === "insolvenz" && (
              <div role="tabpanel" id="panel-insolvenz">
                <SectionTitle
                  eyebrow="Insolvenz · Restructuring"
                  title="Insolvenz-Pulse · 30 Tage"
                  hint="Outplacement · Restructuring · Goldmine"
                />
                <ErrorBoundary section="Insolvenz Pulse">
                  <InsolvenzPulsePanel />
                </ErrorBoundary>
              </div>
            )}

            {/* JOBS TAB */}
            {activeTab === "jobs" && (
              <div role="tabpanel" id="panel-jobs" className="space-y-5">
                <SectionTitle
                  eyebrow="Job Market"
                  title="DE Job-Posting Pulse"
                  hint="live · 12 Kategorien · refresh 30 min"
                />
                <ErrorBoundary section="Job Market">
                  <JobMarketPanel />
                </ErrorBoundary>
                <ErrorBoundary section="Macro Strip">
                  <MacroStrip />
                </ErrorBoundary>
              </div>
            )}

            {/* FORECAST TAB */}
            {activeTab === "forecast" && (
              <div role="tabpanel" id="panel-forecast" className="space-y-8">
                <section>
                  <SectionTitle
                    eyebrow="Forecast"
                    title="Predicted Role Clusters · Forecast Window"
                    hint="RSG Engine · forward forecast"
                  />
                  <ForecastPanel company={selected} />
                </section>
                <section>
                  <SectionTitle
                    eyebrow="Temporal"
                    title="Signal Timeline · 90 days"
                    hint="aggregate event volume · negative-flag overlay"
                  />
                  <SignalTimeline companies={filtered} />
                </section>
              </div>
            )}

            {/* BRIEFING TAB */}
            {activeTab === "briefing" && (
              <div role="tabpanel" id="panel-briefing" className="space-y-5">
                <SectionTitle
                  eyebrow="Daily Briefing"
                  title="Morning Brief · Layoffs · Hiring · Deals"
                  hint="live · refresh 4h"
                />
                <ErrorBoundary section="Morning Brief">
                  <MorningBriefCard
                    watchlistCompanies={data.companies.map((c) => ({
                      id: c.id,
                      name: c.name,
                    }))}
                  />
                </ErrorBoundary>
                <ErrorBoundary section="Wire Feed">
                  <BreakingNewsStrip />
                </ErrorBoundary>
              </div>
            )}

            {/* STRATEGY LAB TAB */}
            {activeTab === "strategy-lab" && (
              <div role="tabpanel" id="panel-strategy-lab" className="space-y-5">
                <SectionTitle
                  eyebrow="Strategy Lab · Pro"
                  title="Multi-Agent Hiring Brief · DACH"
                  hint="virtuelles Vorstandsgremium · konsolidierter Output"
                />
                <ErrorBoundary section="Strategy Lab">
                  <StrategyLabPanel />
                </ErrorBoundary>
              </div>
            )}

            <footer className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-bg-border pt-6 font-mono text-2xs uppercase tracking-wider text-text-muted md:flex-row">
              <span>
                RSG · Market Intelligence Terminal · DE / DACH focus
              </span>
              <span className="flex items-center gap-3">
                <a href="/impressum" className="hover:text-accent-cyan">
                  Impressum
                </a>
                <span className="text-text-faint">·</span>
                <a href="/datenschutz" className="hover:text-accent-cyan">
                  Datenschutz
                </a>
                <span className="text-text-faint">·</span>
                <span className="text-text-faint">
                  v1.0 · RSG Engine · live
                </span>
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
        sections={[]}
        signalTypes={SIGNAL_TYPE_LABELS}
        onSelectCompany={(id) => {
          setSelectedId(id);
          setActiveTab("companies");
        }}
        onJumpToAnchor={() => {}}
        onFilterBySignal={(signalType) => {
          setFilters((f) => ({
            ...f,
            category: signalType as FilterState["category"],
          }));
          setActiveTab("companies");
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
