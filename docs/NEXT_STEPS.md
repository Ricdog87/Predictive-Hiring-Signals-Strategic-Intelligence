# Next Steps

This MVP is intentionally a self-contained UI on mock data. The roadmap takes
it from "lokal lauffähiges Dashboard" to a production radar inside the RSG
ecosystem (Hermes, n8n, MiroFish).

## Phase 1 — Stabilise the MVP shell

- [ ] Add a small smoke test harness for `lib/scoring.ts` (pure function,
      easy to test).
- [ ] Add Storybook or a `/components` route with isolated component states.
- [ ] Light-mode theme variant (optional).
- [ ] Keyboard shortcuts: `j/k` to move through the radar, `esc` to close
      the detail panel.

## Phase 2 — Replace the mock data layer

Goal: same UI, real data.

- [ ] Introduce `lib/api.ts` with `getCompanies(): Promise<ScoredCompany[]>`
      that today wraps `mockData` + `scoreAll`.
- [ ] Convert `app/page.tsx` shell to a Server Component that calls
      `getCompanies` and passes data to a client child for filtering.
- [ ] Define the Hermes HTTP contract (`GET /companies?since=…`) — the
      response shape must match `ScoredCompany`.
- [ ] Implement a Hermes-backed `getCompanies` behind an env flag
      (`DATA_SOURCE=hermes|mock`).

## Phase 3 — n8n ingestion

- [ ] LinkedIn Jobs scraper workflow → emits `hiring_velocity` signals.
- [ ] Crunchbase webhook / poller → emits `funding_round` signals.
- [ ] Press / RSS poller → emits `office_expansion` and `leadership_change`
      signals.
- [ ] GitHub org watcher → emits `tech_stack_shift` signals.
- [ ] All workflows post to a single Hermes ingest endpoint with a typed
      signal payload.

## Phase 4 — Scoring service in Hermes

- [ ] Lift `lib/scoring.ts` into a Hermes module unchanged.
- [ ] Re-fit weights against backtested data (see SCORING_MODEL.md).
- [ ] Expose per-component confidence so the UI can render a confidence band.
- [ ] Persist daily score snapshots so the dashboard can show trend lines.

## Phase 5 — MiroFish integration

- [ ] Embed the radar (or a focused list) as a MiroFish board widget.
- [ ] Allow analysts to "pin" a company onto a MiroFish board and have it
      auto-update with new signals.
- [ ] Two-way comments: notes added in MiroFish appear in the company detail
      panel.

## Out of scope (do not add)

- HubSpot or any CRM write integrations
- E-mail / outreach / sequencing
- Lead enrichment pipelines aimed at outbound
- Multi-tenant accounts and billing

These belong to other RSG products. The radar stays a **predictive
intelligence surface**.

## Open questions

- Do we need per-user saved filters (watchlists) before Phase 2, or can we
  defer until Hermes is in place?
- What is the right cadence for score recomputation — on every signal, or
  daily batch with a "recompute now" hook?
- How do we display contradicting signals (e.g. funding round + layoff
  pivot) — single combined score, or split into "expansion PHS" and "stress
  index"?
