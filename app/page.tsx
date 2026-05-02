"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { KpiCards } from "@/components/KpiCards";
import { FilterBar } from "@/components/FilterBar";
import { SignalTable } from "@/components/SignalTable";
import { CompanyDetailPanel } from "@/components/CompanyDetailPanel";
import { SignalTimeline } from "@/components/SignalTimeline";
import { ArchitectureFlow } from "@/components/ArchitectureFlow";
import { MOCK_COMPANIES } from "@/lib/mockData";
import { scoreAll } from "@/lib/scoring";
import type { FilterState } from "@/lib/types";

const INITIAL_FILTERS: FilterState = {
  search: "",
  industries: [],
  regions: [],
  minScore: 0,
  category: "all",
};

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

  return (
    <div className="relative min-h-screen bg-bg-base">
      <div className="pointer-events-none fixed inset-0 bg-grid bg-grid-fade opacity-60" />

      <div className="relative flex min-h-screen">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header />

          <main className="flex-1 px-5 py-5">
            <SectionTitle
              eyebrow="01 · Overview"
              title="Predictive Hiring Score · Live Radar"
              hint="Snapshot of all tracked companies, ranked by PHS"
            />
            <KpiCards companies={filtered} />

            <div className="mt-6">
              <SectionTitle
                eyebrow="02 · Query"
                title="Filter Console"
                hint="Search · score floor · category · industry · region"
              />
              <FilterBar
                state={filters}
                onChange={setFilters}
                resultCount={filtered.length}
                totalCount={scored.length}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
              <div className="min-w-0 space-y-5">
                <div>
                  <SectionTitle
                    eyebrow="03 · Companies"
                    title="Hiring Signal Radar"
                    hint="Click any row to load the inspector panel"
                  />
                  <SignalTable
                    companies={filtered}
                    selectedId={selected?.id ?? null}
                    onSelect={(id) =>
                      setSelectedId((prev) => (prev === id ? null : id))
                    }
                  />
                </div>
              </div>
              <div className="min-w-0">
                <SectionTitle
                  eyebrow="04 · Inspector"
                  title="Company Detail"
                  hint="Score breakdown, drivers, signal stream"
                />
                <CompanyDetailPanel
                  company={selected}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="05 · Temporal"
                title="Signal Timeline · 90 days"
                hint="Aggregate event volume + per-category density"
              />
              <SignalTimeline companies={filtered} />
            </div>

            <div className="mt-6">
              <SectionTitle
                eyebrow="06 · System"
                title="Architecture Flow"
                hint="How the radar plugs into the RSG ecosystem"
              />
              <ArchitectureFlow />
            </div>

            <footer className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-bg-border pt-6 font-mono text-2xs uppercase tracking-wider text-text-muted md:flex-row">
              <span>RSG · Predictive Hiring Radar · Strategic Intelligence Terminal</span>
              <span className="text-text-faint">
                v0.1 MVP · UI polish build · designed for Hermes / n8n / MiroFish
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
