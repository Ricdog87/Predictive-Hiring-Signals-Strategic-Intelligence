# Next UI Steps

The v1.0 Final Radar branch consumes the live Codex Market Intelligence API.
Build & typecheck are green. Next iterations layer interaction depth and
resilience on top of the existing surfaces — without changing the engine
contract.

## Phase A · Resilience & loading polish

- [ ] Wire `LoadingSkeletons` per panel rather than as a single overlay.
- [ ] Show per-endpoint `ErrorState` with retry on 4xx/5xx.
- [ ] Distinguish `mock` vs `live` source state in the sidebar's data-source
      list from a real status endpoint, not the hard-coded list.
- [ ] Add SWR / React Query for caching + revalidation.

## Phase B · Power-user interaction

- [ ] Wire `⌘K` to a global command palette (search companies, jump to
      sector, jump to region, jump to cluster).
- [ ] Wire `⌘F` to focus the filter input.
- [ ] `j` / `k` to move row selection in the radar; `o` to open inspector
      detail; `esc` to close.
- [ ] Persist filter + selected row in URL (`?q=…&phs=60&sector=…`).
- [ ] Save / load named queries (frontend only, localStorage at first).

## Phase C · Inspector depth

- [ ] Score history line chart in the inspector (90d daily PHS) once Codex
      exposes snapshots.
- [ ] Confidence interval band on the score history chart.
- [ ] Driver explainability tooltip: surface the full `breakdown[]` from
      `latestScore`, not just the top 3.
- [ ] Comparable companies tray (peer set by sector + size band).
- [ ] Drill-down from a forecast role cluster → roles list (read-only) once
      Codex exposes role-level data.

## Phase D · Sector / region / cluster routes

- [ ] Sector detail route (`/sectors/[id]`): drill into a sector's
      companies, leader board, cohort timeline.
- [ ] Region detail route (`/regions/[id]`) with country-level split for
      DACH (DE / AT / CH).
- [ ] Cluster detail route (`/clusters/[sector]/[region]`).
- [ ] Heatmap mode toggle for sector signal types (e.g. "show me where
      `funding_grant` is hottest").

## Phase E · Visual polish

- [ ] Light-mode variant (defer until requested).
- [ ] Compact mode toggle for analysts on small displays.
- [ ] Move the ticker source from hard-coded mock to a small Codex endpoint
      that emits the top movers.

## Out of scope (do not add)

- Candidate / applicant / talent profile views
- Outreach, e-mail, CRM, sequencing
- HubSpot or any CRM-side write integration
- Live scraping inside the UI

## Open questions

- Should `/api/companies` return aggregates directly so the radar table
  doesn't fan out into N `/api/company/[id]` calls? Today the dashboard
  parallelises but it is bounded by mock dataset size.
- Where does the watchlist persistence live — Codex side, or a separate
  user-state service? UI currently treats watchlists as scaffold-only.
