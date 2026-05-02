"use client";

import type {
  FilterState,
  Industry,
  Region,
  SignalCategory,
} from "@/lib/types";
import { categoryLabels } from "@/lib/format";

const INDUSTRIES: Industry[] = [
  "SaaS",
  "Fintech",
  "Healthtech",
  "AI/ML",
  "Logistics",
  "Cybersecurity",
  "E-Commerce",
  "Climate Tech",
];

const REGIONS: Region[] = [
  "DACH",
  "Nordics",
  "UK & Ireland",
  "BeNeLux",
  "Iberia",
  "North America",
];

interface FilterBarProps {
  state: FilterState;
  onChange: (next: FilterState) => void;
  resultCount: number;
}

export function FilterBar({ state, onChange, resultCount }: FilterBarProps) {
  const toggle = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  return (
    <div className="rounded-xl border border-bg-border bg-bg-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <input
            value={state.search}
            onChange={(e) => onChange({ ...state, search: e.target.value })}
            placeholder="Search company, domain, headquarters…"
            className="w-full rounded-lg border border-bg-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-cyan/60 focus:outline-none focus:ring-2 focus:ring-accent-cyan/20"
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-bg-border bg-bg-elevated px-3 py-2">
          <span className="text-xs uppercase tracking-wider text-text-muted">
            Min PHS
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={state.minScore}
            onChange={(e) =>
              onChange({ ...state, minScore: Number(e.target.value) })
            }
            className="accent-accent-cyan"
          />
          <span className="w-8 text-right text-sm tabular-nums text-text-primary">
            {state.minScore}
          </span>
        </div>

        <select
          value={state.category}
          onChange={(e) =>
            onChange({
              ...state,
              category: e.target.value as SignalCategory | "all",
            })
          }
          className="rounded-lg border border-bg-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent-cyan/60 focus:outline-none"
        >
          <option value="all">All signal types</option>
          {(Object.keys(categoryLabels) as SignalCategory[]).map((c) => (
            <option key={c} value={c}>
              {categoryLabels[c]}
            </option>
          ))}
        </select>

        <div className="text-xs text-text-secondary">
          <span className="tabular-nums text-text-primary">{resultCount}</span>{" "}
          companies
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] uppercase tracking-wider text-text-muted">
          Industry
        </span>
        {INDUSTRIES.map((ind) => {
          const active = state.industries.includes(ind);
          return (
            <button
              key={ind}
              onClick={() =>
                onChange({ ...state, industries: toggle(state.industries, ind) })
              }
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan"
                  : "border-bg-border bg-bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              {ind}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] uppercase tracking-wider text-text-muted">
          Region
        </span>
        {REGIONS.map((r) => {
          const active = state.regions.includes(r);
          return (
            <button
              key={r}
              onClick={() =>
                onChange({ ...state, regions: toggle(state.regions, r) })
              }
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "border-accent-violet/50 bg-accent-violet/10 text-accent-violet"
                  : "border-bg-border bg-bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>
    </div>
  );
}
