"use client";

import { useEffect } from "react";
import { PRIMARY_NAV, type TabId } from "@/lib/uiMockData";

interface DashboardTabsProps {
  active: TabId;
  onChange: (id: TabId) => void;
  /** Optional badge counts shown to the right of the tab label. */
  counts?: Partial<Record<TabId, number>>;
}

/**
 * Sticky Bloomberg-style tab bar. Only the active tab's content renders
 * downstream — the dashboard does not stack panels anymore.
 */
export function DashboardTabs({ active, onChange, counts }: DashboardTabsProps) {
  // Persist choice across reloads. Sidebar/chord/click all flow through
  // onChange so that's where we observe.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("rsg.activeTab", active);
    } catch {
      /* private mode → ignore */
    }
  }, [active]);

  return (
    <div className="sticky top-12 z-20 border-b border-bg-border bg-bg-base/92 backdrop-blur">
      <nav
        role="tablist"
        aria-label="Dashboard sections"
        className="flex items-stretch gap-px overflow-x-auto bg-bg-border"
      >
        {PRIMARY_NAV.map((tab) => {
          const isActive = active === tab.id;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              title={
                tab.chord ? `${tab.label} · ${tab.chord}` : tab.label
              }
              className={[
                "group relative flex shrink-0 items-center gap-2 px-4 py-2.5 font-mono text-2xs uppercase tracking-terminal transition-colors",
                isActive
                  ? "bg-bg-base text-accent-cyan"
                  : "bg-bg-surface text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary",
              ].join(" ")}
            >
              <span
                className={
                  isActive ? "text-accent-cyan" : "text-text-muted"
                }
                aria-hidden
              >
                {tab.glyph}
              </span>
              <span className="text-[11.5px]">{tab.label}</span>
              {tab.id === "strategy-lab" && (
                <span
                  className={[
                    "rounded-sm px-1 text-[9px] font-semibold uppercase tracking-wider",
                    isActive
                      ? "bg-accent-cyan/15 text-accent-cyan"
                      : "bg-bg-elevated text-accent-cyan/80",
                  ].join(" ")}
                >
                  Pro
                </span>
              )}
              {typeof count === "number" && count > 0 && (
                <span
                  className={[
                    "rounded-sm px-1 text-[10px] font-semibold",
                    isActive
                      ? "bg-accent-cyan/15 text-accent-cyan"
                      : "bg-bg-elevated text-text-secondary",
                  ].join(" ")}
                >
                  {count}
                </span>
              )}
              {tab.chord && (
                <span className="hidden text-[10px] text-text-faint lg:inline">
                  · {tab.chord}
                </span>
              )}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-px bg-accent-cyan"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Small client-side store for the active tab. Encapsulated here so
 * page.tsx doesn't have to know the storage key.
 */
export function readPersistedTab(): TabId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem("rsg.activeTab");
    if (!v) return null;
    return (PRIMARY_NAV.some((t) => t.id === v) ? (v as TabId) : null);
  } catch {
    return null;
  }
}
