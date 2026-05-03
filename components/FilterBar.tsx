"use client";

import { useCallback, useRef } from "react";
import { signalTypeLabel } from "@/lib/marketIntelligence";
import type { HiringSignalType } from "@/lib/types";
import { useSearchFocusListener } from "@/lib/uiHooks";

export interface FilterState {
  search: string;
  industries: string[];
  regions: string[];
  minScore: number;
  category: HiringSignalType | "all";
}

const SIGNAL_TYPES: HiringSignalType[] = [
  "job_spike",
  "employee_growth",
  "funding_grant",
  "location_expansion",
  "new_business_unit",
  "product_launch",
  "patent_filing",
  "gf_change",
  "press_release",
  "mna_buy",
  "mna_sell",
  "restructuring",
  "insolvency",
];

interface FilterBarProps {
  state: FilterState;
  onChange: (next: FilterState) => void;
  resultCount: number;
  totalCount: number;
  sectorOptions: string[];
  regionOptions: string[];
}

export function FilterBar({
  state,
  onChange,
  resultCount,
  totalCount,
  sectorOptions,
  regionOptions,
}: FilterBarProps) {
  const toggle = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const reset = () =>
    onChange({
      search: "",
      industries: [],
      regions: [],
      minScore: 0,
      category: "all",
    });

  const hasActiveFilters =
    state.search.length > 0 ||
    state.industries.length > 0 ||
    state.regions.length > 0 ||
    state.minScore > 0 ||
    state.category !== "all";

  const searchRef = useRef<HTMLInputElement | null>(null);
  const focusSearch = useCallback(() => {
    const el = searchRef.current;
    if (!el) return;
    el.focus();
    el.select();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  useSearchFocusListener(focusSearch);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Query Console</span>
          <span className="font-mono text-[11px] text-text-secondary">
            <span className="text-accent-cyan">{resultCount}</span>
            <span className="text-text-faint"> / {totalCount}</span>
            <span className="ml-2 text-text-muted">companies on radar</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={reset}
              className="font-mono text-2xs uppercase tracking-wider text-text-muted hover:text-accent-cyan"
            >
              ✕ Clear query
            </button>
          )}
          <span
            className="label-eyebrow rounded-sm border border-bg-border bg-bg-surface px-1.5 py-0.5 text-text-faint"
            title="Press / or ⌘K to focus search"
          >
            / · ⌘K
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-accent-cyan">
            ⌕
          </span>
          <input
            ref={searchRef}
            value={state.search}
            onChange={(e) => onChange({ ...state, search: e.target.value })}
            placeholder="Search company, sector, headquarters… (press /)"
            className="w-full rounded-sm border border-bg-border bg-bg-surface px-7 py-1.5 font-mono text-[12px] text-text-primary placeholder:text-text-muted focus:border-accent-cyan/60 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30"
          />
        </div>

        <div className="flex items-center gap-2 rounded-sm border border-bg-border bg-bg-surface px-3 py-1.5">
          <span className="label-eyebrow">Min Hiring Score</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={state.minScore}
            onChange={(e) =>
              onChange({ ...state, minScore: Number(e.target.value) })
            }
            className="w-28 accent-accent-cyan"
          />
          <span className="num w-8 text-right text-[12px] text-text-primary">
            {state.minScore}
          </span>
        </div>

        <select
          value={state.category}
          onChange={(e) =>
            onChange({
              ...state,
              category: e.target.value as HiringSignalType | "all",
            })
          }
          className="rounded-sm border border-bg-border bg-bg-surface px-3 py-1.5 font-mono text-[12px] text-text-primary focus:border-accent-cyan/60 focus:outline-none"
        >
          <option value="all">All company signal types</option>
          {SIGNAL_TYPES.map((c) => (
            <option key={c} value={c}>
              {signalTypeLabel(c)}
            </option>
          ))}
        </select>
      </div>

      {sectorOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-bg-border px-3 py-2">
          <span className="label-eyebrow w-14 shrink-0">Sector</span>
          {sectorOptions.map((ind) => {
            const active = state.industries.includes(ind);
            return (
              <button
                key={ind}
                onClick={() =>
                  onChange({
                    ...state,
                    industries: toggle(state.industries, ind),
                  })
                }
                className={`rounded-sm border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  active
                    ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan"
                    : "border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary"
                }`}
              >
                {ind}
              </button>
            );
          })}
        </div>
      )}

      {regionOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-bg-border px-3 py-2">
          <span className="label-eyebrow w-14 shrink-0">Region</span>
          {regionOptions.map((r) => {
            const active = state.regions.includes(r);
            return (
              <button
                key={r}
                onClick={() =>
                  onChange({ ...state, regions: toggle(state.regions, r) })
                }
                className={`rounded-sm border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  active
                    ? "border-accent-violet/50 bg-accent-violet/10 text-accent-violet"
                    : "border-bg-border bg-bg-surface text-text-secondary hover:text-text-primary"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
