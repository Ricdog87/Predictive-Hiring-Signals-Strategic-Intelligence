"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePaletteHotkey, useSingle } from "@/lib/hotkeys";
import { useWatchlist } from "@/lib/watchlist";
import type { CompanyView } from "@/lib/marketView";

interface SectionTarget {
  id: string;
  label: string;
  anchor: string;
}

interface SignalTarget {
  id: string;
  label: string;
}

interface CommandPaletteProps {
  companies: CompanyView[];
  sections: SectionTarget[];
  signalTypes: SignalTarget[];
  onSelectCompany: (companyId: string) => void;
  onJumpToAnchor: (anchor: string) => void;
  onFilterBySignal?: (signalType: string) => void;
  /** Optional: invoked when user picks "Research live · <q>" — palette closes. */
  onResearchCompany?: (query: string) => void;
}

type ItemKind = "company" | "section" | "signal" | "watch" | "research";

interface PaletteItem {
  kind: ItemKind;
  /** Stable id for selection state. */
  id: string;
  /** Primary label rendered in the row. */
  label: string;
  /** Faint, secondary detail. */
  detail?: string;
  /** Glyph rendered in the leading position. */
  glyph: string;
  /** What happens on Enter. */
  invoke: () => void;
  /** Lower = ranked higher. */
  rank: number;
}

function fuzzyScore(needle: string, hay: string): number {
  if (!needle) return 0;
  const n = needle.toLowerCase();
  const h = hay.toLowerCase();
  if (h.startsWith(n)) return -1000;
  if (h.includes(n)) return -500;
  // Subsequence fallback
  let i = 0;
  let last = -1;
  let total = 0;
  for (const ch of n) {
    const idx = h.indexOf(ch, last + 1);
    if (idx === -1) return Infinity;
    total += idx - last;
    last = idx;
    i++;
  }
  return total;
}

export function CommandPalette({
  companies,
  sections,
  signalTypes,
  onSelectCompany,
  onJumpToAnchor,
  onFilterBySignal,
  onResearchCompany,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { pinned } = useWatchlist();

  usePaletteHotkey(() => setOpen((v) => !v));
  useSingle("?", () => setOpen(true));

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      // delay so the input is mounted before focus
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  // Build a flat, ranked list of palette items.
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];

    // Watchlist first
    for (const id of pinned) {
      const c = companies.find((x) => x.id === id);
      if (!c) continue;
      items.push({
        kind: "watch",
        id: `watch:${id}`,
        label: c.name,
        detail: `${c.industry} · pinned · score ${Math.round(c.hiringScore)}`,
        glyph: "★",
        invoke: () => onSelectCompany(id),
        rank: -10000,
      });
    }

    for (const s of sections) {
      items.push({
        kind: "section",
        id: `sec:${s.id}`,
        label: `Go to ${s.label}`,
        detail: `Jump to section · #${s.anchor}`,
        glyph: "→",
        invoke: () => onJumpToAnchor(s.anchor),
        rank: 0,
      });
    }

    for (const c of companies) {
      items.push({
        kind: "company",
        id: `co:${c.id}`,
        label: c.name,
        detail: `${c.industry} · ${c.region} · score ${Math.round(c.hiringScore)}`,
        glyph: "◫",
        invoke: () => onSelectCompany(c.id),
        rank: 0,
      });
    }

    if (onFilterBySignal) {
      for (const st of signalTypes) {
        items.push({
          kind: "signal",
          id: `sig:${st.id}`,
          label: `Filter · ${st.label}`,
          detail: `Restrict company table to ${st.id}`,
          glyph: "≈",
          invoke: () => onFilterBySignal(st.id),
          rank: 100,
        });
      }
    }
    return items;
  }, [
    companies,
    sections,
    signalTypes,
    pinned,
    onSelectCompany,
    onJumpToAnchor,
    onFilterBySignal,
  ]);

  const filtered = useMemo(() => {
    const trimmed = q.trim();
    let base: PaletteItem[];
    if (!trimmed) {
      base = allItems
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 24);
    } else {
      base = allItems
        .map((it) => {
          const sLabel = fuzzyScore(trimmed, it.label);
          const sDetail = it.detail ? fuzzyScore(trimmed, it.detail) : Infinity;
          return { it, score: Math.min(sLabel, sDetail) };
        })
        .filter((x) => Number.isFinite(x.score))
        .sort((a, b) => a.score - b.score || a.it.rank - b.it.rank)
        .slice(0, 24)
        .map((x) => x.it);
    }

    // Always append a "Research live · <q>" item when the user has typed
    // at least 3 characters and the radar has a research callback. This
    // is the search-field-for-any-company escape hatch — Sonar (live web)
    // researches any firm, not just the ones in the master.
    if (onResearchCompany && trimmed.length >= 3) {
      base.push({
        kind: 'research',
        id: `research:${trimmed}`,
        label: `Research live · "${trimmed}"`,
        detail: 'Live web search via Sonar — works for any company, not just the master',
        glyph: '✦',
        invoke: () => onResearchCompany(trimmed),
        rank: 1000,
      });
    }
    return base;
  }, [allItems, q, onResearchCompany]);

  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[14vh] palette-backdrop animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-[640px] rounded-md border border-bg-border bg-bg-panel shadow-glow animate-slide-down overflow-hidden">
        <div className="flex items-center gap-3 border-b border-bg-border px-4 py-3">
          <span className="text-text-muted">⌘K</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const it = filtered[active];
                if (it) {
                  it.invoke();
                  setOpen(false);
                }
              }
            }}
            placeholder="Search companies, sections, signal types…"
            className="flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-muted outline-none"
          />
          <span className="kbd">esc</span>
        </div>

        <div className="max-h-[55vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-2xs uppercase tracking-terminal text-text-muted">
              no matches
            </div>
          ) : (
            filtered.map((it, i) => {
              const isActive = i === active;
              return (
                <button
                  key={it.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    it.invoke();
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                    isActive
                      ? "bg-accent-cyan/10 text-text-primary"
                      : "text-text-secondary hover:bg-bg-elevated"
                  }`}
                >
                  <span
                    className={`font-mono text-[14px] w-4 text-center ${
                      it.kind === "watch"
                        ? "text-accent-amber"
                        : it.kind === "section"
                        ? "text-accent-violet"
                        : it.kind === "signal"
                        ? "text-accent-green"
                        : it.kind === "research"
                        ? "text-accent-violet"
                        : "text-accent-cyan"
                    }`}
                  >
                    {it.glyph}
                  </span>
                  <span className="flex-1 truncate text-[13px]">
                    {it.label}
                  </span>
                  {it.detail && (
                    <span className="hidden md:inline truncate font-mono text-2xs uppercase tracking-terminal text-text-muted max-w-[280px]">
                      {it.detail}
                    </span>
                  )}
                  {isActive && <span className="kbd">↵</span>}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-bg-border bg-bg-surface px-4 py-2 font-mono text-2xs uppercase tracking-terminal text-text-muted">
          <span className="flex items-center gap-2">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
            <span>navigate</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="kbd">↵</span>
            <span>open</span>
            <span className="text-text-faint">·</span>
            <span className="kbd">esc</span>
            <span>close</span>
          </span>
        </div>
      </div>
    </div>
  );
}
