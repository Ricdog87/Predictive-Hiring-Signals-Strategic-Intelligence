"use client";

import { useMemo, useState } from "react";
import { MarketOverviewHeader } from "@/components/MarketOverviewHeader";
import { IntelligenceSidebar } from "@/components/IntelligenceSidebar";
import { FilterBar } from "@/components/FilterBar";
import { CompanySignalTable } from "@/components/CompanySignalTable";
import { CompanyDetailPanel } from "@/components/CompanyDetailPanel";
import { SignalTimeline } from "@/components/SignalTimeline";
import { ForecastPanel } from "@/components/ForecastPanel";
import { SectorIntelligencePanel } from "@/components/SectorIntelligencePanel";
import { RegionIntelligencePanel } from "@/components/RegionIntelligencePanel";
import { MarketClusterView } from "@/components/MarketClusterView";
import { ArchitectureFlow } from "@/components/ArchitectureFlow";
import { MOCK_COMPANIES } from "@/lib/mockData";
import { scoreAll } from "@/lib/scoring";
import {
  deriveMarketClusters,
  deriveMarketOverview,
  deriveRegionTrends,
  deriveSectorTrends,
} from "@/lib/marketIntelligence";
import type { FilterState, Industry, Region } from "@/lib/types";

const INITIAL_FILTERS: FilterState = {
  search: "",
  industries: [],
  regions: [],
  minScore: 0,
  category: "all",
};

const ALL_SECTORS: Industry[] = [
  "AI/ML",
  "Fintech",
  "SaaS",
  "Healthtech",
  "Cybersecurity",
  "Climate Tech",
  "Logistics",
  "E-Commerce",
];
const ALL_REGIONS: Region[] = [
  "DACH",
  "Nordics",
  "UK & Ireland",
  "BeNeLux",
  "Iberia",
  "North America",
];

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>("c-011");

  const scored = useMemo(() => scoreAll(MOCK_COMPANIES), []);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return scored.filter((c) => {
      if (
        filters.industries.length &&
        !filters.industries.includes(c.industry)
      )
        return false;
      if (filters.regions.length && !filters.regions.includes(c.region))
        return false;
      if (c.score < filters.minScore) return false;
      if (filters.category !== "all") {
        if (!c.signals.some((s) => s.category === filters.category))
          return false;
      }
      if (search) {
        const blob = `${c.name} ${c.domain} ${c.headquarters}`.toLowerCase();
        if (!blob.includes(search)) return false;
      }
      return true;
    });
  }, [scored, filters]);

  const selected =
    filtered.find((c) => c.id === selectedId) ??
    scored.find((c) => c.id === selectedId) ??
    null;

  // Market Intelligence — UI-only derivations matching the Codex contract.
  // Replace with `fetch('/api/...')` once the routes ship.
  const overview = useMemo(() => deriveMarketOverview(filtered), [filtered]);
  const sectors = useMemo(() => deriveSectorTrends(filtered), [filtered]);
  const regions = useMemo(() => deriveRegionTrends(filtered), [filtered]);
  const clusters = useMemo(() => deriveMarketClusters(filtered), [filtered]);

  const clearFilters = () => setFilters(INITIAL_FILTERS);

  return (
    <div className="relative min-h-screen bg-bg-base">
      <div className="pointer-events-none fixed inset-0 bg-grid bg-grid-fade opacity-60" />

      <div className="relative flex min-h-screen">
        <IntelligenceSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <MarketOverviewHeader overview={overview} />

          <main className="flex-1 px-5 py-5">
            <div>
              <SectionTitle
                eyebrow="01 · Sector Intelligence"
                title="Sector Trends · Hottest sectors"
                hint="signal volume × momentum × confidence · DE/DACH context"
              />
              <SectorIntelligencePanel sectors={sectors} />
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="02 · Region Intelligence"
                title="Regional Hiring Pulse"
                hint="dominant sectors · momentum · germanyShare on DACH"
              />
              <RegionIntelligencePanel regions={regions} />
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="03 · Clusters"
                title="Sector × Region Heatmap"
                hint="opportunity / risk levels · dominant signals"
              />
              <MarketClusterView
                clusters={clusters}
                sectors={ALL_SECTORS}
                regions={ALL_REGIONS}
              />
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
                totalCount={scored.length}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
              <div className="min-w-0 space-y-5">
                <div>
                  <SectionTitle
                    eyebrow="05 · Companies"
                    title="Company Signal Radar"
                    hint="Click any row to load the inspector panel"
                  />
                  <CompanySignalTable
                    companies={filtered}
                    selectedId={selected?.id ?? null}
                    onSelect={(id) =>
                      setSelectedId((prev) => (prev === id ? null : id))
                    }
                    onClearFilters={clearFilters}
                  />
                </div>
              </div>
              <div className="min-w-0">
                <SectionTitle
                  eyebrow="06 · Inspector"
                  title="Company Detail"
                  hint="Hiring score · confidence · signal stream"
                />
                <CompanyDetailPanel
                  company={selected}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="07 · Forecast"
                title="Predicted Role Clusters · Forecast Window"
                hint="UI projection from Codex engine outputs"
              />
              <ForecastPanel company={selected} />
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="08 · Temporal"
                title="Signal Timeline · 90 days"
                hint="Aggregate event volume · per-category density · negative flags"
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
                v0.3 · UI consumes typed Codex contracts · read-only intelligence
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
