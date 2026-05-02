# Architecture

## v0.1 (this repo)

A self-contained Next.js App Router application. No backend, no database, no
external integrations.

```
┌──────────────────────────────────────────────┐
│ Next.js (App Router) — Client Components     │
│                                              │
│  app/page.tsx                                │
│   ├─ KpiCards                                │
│   ├─ FilterBar                               │
│   ├─ SignalTable                             │
│   └─ CompanyDetailPanel                      │
│                                              │
│  lib/scoring.ts ◄── single source of truth   │
│  lib/mockData.ts ── replaceable later        │
└──────────────────────────────────────────────┘
```

### Boundaries

- **`lib/types.ts`** defines the public contract for any future data source.
  All UI components consume `ScoredCompany` / `HiringSignal` and have no
  knowledge of where data comes from.
- **`lib/scoring.ts`** is pure: `Company -> ScoredCompany`. It can be moved
  into a Node service or edge function unchanged.
- **`lib/mockData.ts`** is the only file that needs to change to swap in real
  data.

### Rendering

- The dashboard is a client component (interactive filtering, selection).
- Mock data is small enough (≈12 companies) that the entire dataset is scored
  in-memory on every filter change. For real data we would either:
  - move scoring to a server route handler and stream results, or
  - keep client-side scoring but paginate / virtualize the table.

## v0.2 — Hermes-backed (target)

Hermes becomes the data plane. The dashboard talks to Hermes over HTTP and
keeps the same UI surface.

```
                ┌─────────────────────────┐
                │ n8n ingestion workflows │
                │  · LinkedIn Jobs        │
                │  · Crunchbase           │
                │  · Press / RSS          │
                │  · GitHub orgs          │
                └────────────┬────────────┘
                             │ events
                             ▼
                ┌─────────────────────────┐
                │ Hermes                  │
                │  · raw signal store     │
                │  · scoring service      │
                │  · companies API        │
                └────────────┬────────────┘
                             │ REST/GraphQL
                             ▼
                ┌─────────────────────────┐
                │ Predictive Hiring Radar │
                │ (this repo)             │
                └────────────┬────────────┘
                             │ embeds
                             ▼
                ┌─────────────────────────┐
                │ MiroFish boards         │
                └─────────────────────────┘
```

### Migration path

1. Introduce `lib/api.ts` exporting `getCompanies(): Promise<ScoredCompany[]>`
   that today reads `mockData.ts` and runs `scoreAll`.
2. Convert the dashboard page to a Server Component that calls `getCompanies`
   and renders an interactive child for filtering.
3. Replace the implementation of `getCompanies` with a Hermes HTTP call.
   No component changes required.

## Folder layout

```
app/                Next.js entry — layout, page, globals
components/         Presentational components (no fetching, no scoring)
lib/                Domain logic — types, scoring, formatting, data
docs/               Living product + technical documentation
```

## Conventions

- **TypeScript strict mode** is on; prefer narrow types over `any`.
- **Tailwind only** for styling. No CSS modules, no styled-components.
- Components are pure and stateless unless they need to hold UI-only state.
- Domain types live in `lib/types.ts`. UI never invents new domain shapes.
