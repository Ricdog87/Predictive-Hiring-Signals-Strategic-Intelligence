/**
 * UI-only mock data for surfaces that have no engine contract yet (sidebar
 * sources panel, watchlists, market context strip). Replace with real data
 * when Codex exposes equivalent endpoints — no UI changes required.
 */

export interface DataSourceStatus {
  id: string;
  label: string;
  status: "live" | "idle" | "mock" | "down";
  lastSync: string;
  throughput: string;
}

export const DATA_SOURCES: DataSourceStatus[] = [
  {
    id: "linkedin-jobs",
    label: "LinkedIn Jobs",
    status: "live",
    lastSync: "12s ago",
    throughput: "184/h",
  },
  {
    id: "crunchbase",
    label: "Crunchbase",
    status: "live",
    lastSync: "1m ago",
    throughput: "32/h",
  },
  {
    id: "press-rss",
    label: "Press / RSS",
    status: "live",
    lastSync: "4m ago",
    throughput: "76/h",
  },
  {
    id: "github",
    label: "GitHub Orgs",
    status: "idle",
    lastSync: "18m ago",
    throughput: "12/h",
  },
  {
    id: "hermes-ingest",
    label: "Hermes ingest",
    status: "mock",
    lastSync: "—",
    throughput: "—",
  },
];

export interface UIWatchlist {
  id: string;
  name: string;
  count: number;
  pinned: boolean;
  hint: string;
}

export const UI_WATCHLISTS: UIWatchlist[] = [
  {
    id: "wl-eu-ai",
    name: "EU AI Labs",
    count: 14,
    pinned: true,
    hint: "Foundation-model & applied AI labs in EMEA",
  },
  {
    id: "wl-fintech-b",
    name: "Series B Fintech",
    count: 22,
    pinned: false,
    hint: "Recent Series B raises in EU fintech",
  },
  {
    id: "wl-cyber",
    name: "Cyber Unicorns",
    count: 9,
    pinned: false,
    hint: "Cyber companies tracked above $1B",
  },
  {
    id: "wl-climate",
    name: "Climate Tech · DACH",
    count: 17,
    pinned: false,
    hint: "Energy + grid software in DACH",
  },
];

export interface NavSection {
  id: string;
  label: string;
  glyph: string;
  active?: boolean;
  hint?: string;
}

export const PRIMARY_NAV: NavSection[] = [
  { id: "radar", label: "Radar", glyph: "◎", active: true },
  { id: "companies", label: "Companies", glyph: "◫" },
  { id: "signals", label: "Company Signals", glyph: "≈" },
  { id: "timeline", label: "Signal Timeline", glyph: "⌖" },
  { id: "forecast", label: "Forecast", glyph: "ℙ" },
  { id: "sectors", label: "Sector Pulse", glyph: "▤" },
  { id: "watchlists", label: "Watchlists", glyph: "★" },
  { id: "flows", label: "System Flow", glyph: "⇌" },
];
