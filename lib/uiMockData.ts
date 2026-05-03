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
  signalsPerHour: number;
  reliability: number; // 0..1
  coveredSignalTypes: string[];
  description: string;
}

export const DATA_SOURCES: DataSourceStatus[] = [
  {
    id: "bundesanzeiger",
    label: "Bundesanzeiger",
    status: "live",
    lastSync: "1m ago",
    throughput: "12/h",
    signalsPerHour: 12,
    reliability: 0.95,
    coveredSignalTypes: ["restructuring", "insolvency", "gf_change"],
    description:
      "Official German federal gazette filings — high-trust corporate disclosures.",
  },
  {
    id: "handelsregister",
    label: "Handelsregister",
    status: "live",
    lastSync: "3m ago",
    throughput: "8/h",
    signalsPerHour: 8,
    reliability: 0.94,
    coveredSignalTypes: ["restructuring", "gf_change", "mna_buy", "mna_sell"],
    description:
      "German commercial register — leadership changes and structural moves.",
  },
  {
    id: "pressebox",
    label: "Pressebox",
    status: "live",
    lastSync: "2m ago",
    throughput: "24/h",
    signalsPerHour: 24,
    reliability: 0.78,
    coveredSignalTypes: ["press_release", "product_launch", "location_expansion"],
    description: "Aggregated DACH press releases across sectors.",
  },
  {
    id: "company_newsroom",
    label: "Company Newsroom",
    status: "live",
    lastSync: "5m ago",
    throughput: "18/h",
    signalsPerHour: 18,
    reliability: 0.72,
    coveredSignalTypes: ["new_business_unit", "product_launch", "press_release"],
    description: "First-party company newsrooms scraped on a polite cadence.",
  },
  {
    id: "linkedin_company",
    label: "LinkedIn (company)",
    status: "live",
    lastSync: "12s ago",
    throughput: "184/h",
    signalsPerHour: 184,
    reliability: 0.68,
    coveredSignalTypes: ["job_spike", "employee_growth"],
    description:
      "LinkedIn company-side activity — headcount drift and posting velocity.",
  },
  {
    id: "job_posting_trend",
    label: "Job posting trend",
    status: "live",
    lastSync: "26s ago",
    throughput: "92/h",
    signalsPerHour: 92,
    reliability: 0.75,
    coveredSignalTypes: ["job_spike", "employee_growth"],
    description: "Cross-board posting volume normalised against baseline.",
  },
  {
    id: "patent_signals",
    label: "Patent signals",
    status: "idle",
    lastSync: "18m ago",
    throughput: "4/h",
    signalsPerHour: 4,
    reliability: 0.9,
    coveredSignalTypes: ["patent_filing"],
    description: "DPMA / EPO patent feeds, slower cadence by design.",
  },
  {
    id: "funding_signals",
    label: "Funding signals",
    status: "live",
    lastSync: "9m ago",
    throughput: "6/h",
    signalsPerHour: 6,
    reliability: 0.88,
    coveredSignalTypes: ["funding_grant", "mna_buy"],
    description: "Funding rounds, grants, and acquirer-side capital moves.",
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
  { id: "wl-de-mittelstand", name: "DE Mittelstand", count: 28, pinned: true, hint: "Privat geführte Mittelstandsunternehmen" },
  { id: "wl-de-ai", name: "DE · AI/ML", count: 14, pinned: false, hint: "Applied AI labs in DACH" },
  { id: "wl-funding-72w", name: "Funding · last 72w", count: 22, pinned: false, hint: "Companies with a funding signal in 72 weeks" },
  { id: "wl-restructuring", name: "Restructuring watch", count: 9, pinned: false, hint: "Companies with active restructuring or insolvency signals" },
];

export interface NavSection {
  id: string;
  label: string;
  glyph: string;
  targetId: string;
  hint?: string;
}

/**
 * Sidebar navigation. `targetId` matches a `<section id="…">` anchor in
 * the dashboard page; clicking scrolls smoothly to that section and the
 * scroll-spy in `IntelligenceSidebar` highlights whichever section is
 * currently in view.
 */
export const PRIMARY_NAV: NavSection[] = [
  { id: "radar", label: "Market Radar", glyph: "◎", targetId: "section-radar" },
  { id: "companies", label: "Companies", glyph: "◫", targetId: "section-companies" },
  { id: "signals", label: "Company Signals", glyph: "≈", targetId: "section-signals" },
  { id: "timeline", label: "Signal Timeline", glyph: "⌖", targetId: "section-timeline" },
  { id: "forecast", label: "Forecast", glyph: "ℙ", targetId: "section-forecast" },
  { id: "sectors", label: "Sector Trends", glyph: "▤", targetId: "section-sectors" },
  { id: "regions", label: "Region Trends", glyph: "◬", targetId: "section-regions" },
  { id: "clusters", label: "Cluster Heatmap", glyph: "▦", targetId: "section-clusters" },
  { id: "flows", label: "System Flow", glyph: "⇌", targetId: "section-flows" },
];
