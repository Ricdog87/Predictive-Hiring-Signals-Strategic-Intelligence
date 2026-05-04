/**
 * UI-only chrome data — sidebar nav, source-pulse list, watchlist
 * scaffolds. The dashboard panels themselves consume the live Codex API;
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

export interface NavSection {
  id: string;
  label: string;
  glyph: string;
  /** DOM id of the dashboard section that should scroll into view. */
  anchor: string;
  hint?: string;
}

export const PRIMARY_NAV: NavSection[] = [
  { id: "radar", label: "Market Radar", glyph: "◎", anchor: "section-overview" },
  { id: "sectors", label: "Sector Trends", glyph: "▤", anchor: "section-sectors" },
  { id: "regions", label: "Region Trends", glyph: "◬", anchor: "section-regions" },
  { id: "clusters", label: "Cluster Heatmap", glyph: "▦", anchor: "section-clusters" },
  { id: "companies", label: "Companies", glyph: "◫", anchor: "section-companies" },
  { id: "forecast", label: "Forecast", glyph: "ℙ", anchor: "section-forecast" },
  { id: "timeline", label: "Signal Timeline", glyph: "⌖", anchor: "section-timeline" },
];
