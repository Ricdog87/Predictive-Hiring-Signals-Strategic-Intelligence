# Next UI Steps

The v0.3 Market Intelligence Terminal is visually verkaufbar and consumes
typed Codex contracts. The next iterations layer interaction depth and live
data on top of the existing surfaces — without changing the engine contract.

## Phase A · Wire data plane (highest priority)

- [ ] Replace the four `derive*` calls in `app/page.tsx` with `fetch` calls
      against the Codex Market Intelligence API:
      - `GET /api/market-overview` → `MarketOverview`
      - `GET /api/sectors` → `SectorTrend[]`
      - `GET /api/regions` → `RegionTrend[]`
      - `GET /api/clusters` → `MarketCluster[]`
- [ ] Wrap each call in a `getMarketIntelligence()` helper so the four
      panels stay decoupled from transport details.
- [ ] Replace `MOCK_COMPANIES + scoreAll` with `getCompanies()` reading from
      Codex / Hermes.
- [ ] Replace `getConfidenceScore` and `getRoleClusters` UI fallbacks with
      Codex-provided fields.
- [ ] Show `LoadingSkeletons` while data is fetching.
- [ ] Distinguish `mock` vs `live` source state in the sidebar source list
      from the actual API status, not hard-coded.

## Phase B · Power-user interaction

- [ ] Wire `⌘K` to a global command palette (search companies, jump to
      sector, jump to watchlist).
- [ ] Wire `⌘F` to focus the filter input.
- [ ] `j` / `k` to move row selection in the radar; `o` to open inspector
      detail; `esc` to close.
- [ ] Persist filter + selected row in URL (`?q=…&phs=60&ind=AI%2FML`).
- [ ] Save / load named queries (frontend only, localStorage at first).

## Phase C · Inspector depth

- [ ] Score history line chart in the inspector (90d daily PHS) once Codex
      exposes snapshots.
- [ ] Confidence interval band on the score history chart.
- [ ] Driver explainability tooltip (which signals contributed to each
      driver weight).
- [ ] Comparable companies tray (peer set by sector + size band).
- [ ] Drill-down from a forecast role cluster → roles list (read-only).

## Phase D · Sector & watchlist surfaces

- [ ] Sector detail route (`/sectors/[id]`): all companies, leader board,
      cohort timeline.
- [ ] Watchlist detail route (`/watchlists/[id]`) with editable cohorts.
- [ ] Pin a company / company list to a watchlist from the inspector.

## Phase E · Market surfaces depth

- [ ] Time-series mode for `MarketOverview` cells (mini sparkline per cell
      tracking 30d history once Codex exposes snapshots).
- [ ] Sector detail route (`/sectors/[id]`): drill into a sector's
      companies, leader board, cohort timeline.
- [ ] Region detail route (`/regions/[id]`) with country-level split for
      DACH (DE / AT / CH).
- [ ] Cluster detail route (`/clusters/[sector]/[region]`).
- [ ] Heatmap mode toggle for sector signal types (e.g. "show me where
      `funding_round` is hottest").

## Phase F · Visual polish

- [ ] Add a subtle scanline animation to the ticker on idle.
- [ ] Add a "compact mode" toggle for analysts on small displays.
- [ ] Light-mode variant (defer until requested).

## Phase G · Empty / loading / error surfaces

- [ ] Use `TableSkeleton`, `KpiSkeleton`, `InspectorSkeleton` during
      cold-start fetches.
- [ ] Add an `ErrorState` component for failed Codex requests with retry.
- [ ] Add a "no signals in window" empty for the timeline (already done in
      v0.2).

## Out of scope (do not add)

- Candidate / applicant / talent profile views
- Outreach, e-mail, CRM, sequencing
- HubSpot or any CRM-side write integration
- Live scraping inside the UI

## Open questions

- Where does the watchlist write API live — Codex/Hermes or a separate
  user-state service? UI currently treats watchlists as scaffold-only.
- Which keyboard layout do we want (Bloomberg-style function keys vs vim
  navigation)? Bloomberg-style would justify a fixed function-key strip at
  the bottom of the terminal.
- Should the radar default-sort by score or by confidence-adjusted score?
  Currently sorts by score; needs analyst input.
