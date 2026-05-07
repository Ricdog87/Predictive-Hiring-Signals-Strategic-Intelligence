/**
 * UI-only chrome data — sidebar nav, source-pulse list, watchlist
 * scaffolds. The dashboard panels themselves consume the live engine API;
 * this file only powers ambient surface state.
 */

export interface DataSourceStatus {
  id: string;
  label: string;
  status: "live" | "idle" | "mock" | "down";
  lastSync: string;
  throughput: string;
}

export const DATA_SOURCES: DataSourceStatus[] = [
  { id: "bundesanzeiger", label: "Bundesanzeiger", status: "live", lastSync: "1m ago", throughput: "12/h" },
  { id: "handelsregister", label: "Handelsregister", status: "live", lastSync: "3m ago", throughput: "8/h" },
  { id: "pressebox", label: "Pressebox", status: "live", lastSync: "2m ago", throughput: "24/h" },
  { id: "company_newsroom", label: "Company Newsroom", status: "live", lastSync: "5m ago", throughput: "18/h" },
  { id: "linkedin_company", label: "LinkedIn (company)", status: "live", lastSync: "12s ago", throughput: "184/h" },
  { id: "job_posting_trend", label: "Job posting trend", status: "live", lastSync: "26s ago", throughput: "92/h" },
  { id: "patent_signals", label: "Patent signals", status: "idle", lastSync: "18m ago", throughput: "4/h" },
  { id: "funding_signals", label: "Funding signals", status: "live", lastSync: "9m ago", throughput: "6/h" },
];

export interface UIWatchlist {
  id: string;
  name: string;
  count: number;
  pinned: boolean;
  hint: string;
}

export const UI_WATCHLISTS: UIWatchlist[] = [
  { id: "wl-de-mittelstand", name: "DE Mittelstand", count: 28, pinned: true, hint: "Privat geführte Mittelstandsunternehmen" },
  { id: "wl-de-ai", name: "DE · AI/ML", count: 14, pinned: false, hint: "Applied AI labs in DACH" },
  { id: "wl-funding-72w", name: "Funding · last 72w", count: 22, pinned: false, hint: "Companies with a funding signal in 72 weeks" },
  { id: "wl-restructuring", name: "Restructuring watch", count: 9, pinned: false, hint: "Companies with active restructuring or insolvency signals" },
];

/**
 * Bloomberg-style top-level dashboard tabs. Only the active tab renders
 * its content area — keeps the surface clean and click-driven.
 */
export const TAB_IDS = [
  "today",
  "companies",
  "sectors",
  "insolvenz",
  "jobs",
  "forecast",
  "briefing",
] as const;
export type TabId = (typeof TAB_IDS)[number];

export interface NavSection {
  id: TabId;
  label: string;
  glyph: string;
  hint?: string;
  /** Bloomberg-chord shortcut, e.g. "g co". */
  chord?: string;
}

export const PRIMARY_NAV: NavSection[] = [
  { id: "today",     label: "Today",     glyph: "◉", chord: "g t",  hint: "Heute · Movers · Watchlist · Insolvenz" },
  { id: "companies", label: "Companies", glyph: "◫", chord: "g co", hint: "Radar · Filter · Inspector" },
  { id: "sectors",   label: "Macro",     glyph: "▤", chord: "g s",  hint: "Sectors · Regions · DE Quadranten · Clusters" },
  { id: "insolvenz", label: "Insolvenz", glyph: "✖", chord: "g i",  hint: "Insolvenz + Restructuring · 30d" },
  { id: "jobs",      label: "Jobs",      glyph: "⊞", chord: "g j",  hint: "DE Job-Market Pulse" },
  { id: "forecast",  label: "Forecast",  glyph: "ℙ", chord: "g f",  hint: "Predicted roles + Signal Timeline" },
  { id: "briefing",  label: "Briefing",  glyph: "✦", chord: "g b",  hint: "Morning Brief · Layoffs · Hiring · Deals" },
];
