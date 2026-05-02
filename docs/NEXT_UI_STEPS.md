# Next UI Steps

The v0.2 terminal is visually verkaufbar. The next iterations layer
interaction depth on top of the existing surfaces — without changing the
Codex engine contract.

## Phase A · Wire data plane

- [ ] Replace `MOCK_COMPANIES + scoreAll` with `getCompanies(): Promise<...>`
      that reads from Codex (Hermes API).
- [ ] Replace `getConfidenceScore` and `getRoleClusters` UI fallbacks with
      the corresponding Codex fields once exposed.
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

## Phase E · Visual polish

- [ ] Add a subtle scanline animation to the ticker on idle.
- [ ] Add a "compact mode" toggle for analysts on small displays.
- [ ] Light-mode variant (defer until requested).

## Phase F · Empty / loading / error surfaces

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
