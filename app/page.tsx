"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { KpiCards } from "@/components/KpiCards";
import { FilterBar } from "@/components/FilterBar";
import { SignalTable } from "@/components/SignalTable";
import { CompanyDetailPanel } from "@/components/CompanyDetailPanel";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const scored = useMemo(() => scoreAll(MOCK_COMPANIES), []);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return scored.filter((c) => {
      if (filters.industries.length && !filters.industries.includes(c.industry))
        return false;
      if (filters.regions.length && !filters.regions.includes(c.region))
        return false;
      if (c.score < filters.minScore) return false;
      if (filters.category !== "all") {
        if (!c.signals.some((s) => s.category === filters.category)) return false;
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
    <div className="min-h-screen bg-bg-base">
      <Header />
      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <KpiCards companies={filtered} />
            <FilterBar
              state={filters}
              onChange={setFilters}
              resultCount={filtered.length}
            />
            <SignalTable
              companies={filtered}
              selectedId={selected?.id ?? null}
              onSelect={(id) =>
                setSelectedId((prev) => (prev === id ? null : id))
              }
            />
          </div>
          <CompanyDetailPanel
            company={selected}
            onClose={() => setSelectedId(null)}
          />
        </div>

        <footer className="mt-10 border-t border-bg-border py-6 text-center text-xs text-text-muted">
          RSG Predictive Hiring Radar · MVP scaffolding · designed to plug into
          Hermes, n8n &amp; MiroFish in later phases.
        </footer>
      </main>
    </div>
  );
}
