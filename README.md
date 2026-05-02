# RSG Predictive Hiring Radar

Production Market Intelligence Terminal that surfaces **predictive hiring
signals** for German / DACH companies. Bloomberg / Palantir-style read-only
intelligence dashboard backed by the Codex company-intelligence engine.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **TailwindCSS** for the UI
- **Codex backend**: ingestion pipeline, scoring engine, market intelligence
  engine, and API routes (`src/`, `app/api/`, `lib/scoring.ts`,
  `lib/mockData.ts`, `lib/types.ts`)
- **Adapters** for Hermes / n8n / MiroFish handoffs (`adapters/`)
- Read-only intelligence — no candidate, outreach, CRM, or e-mail surfaces

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Other scripts:

```bash
npm run build       # next build
npm run start       # serve production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
```

## Project layout

```
app/
  page.tsx                  Dashboard shell (client) – fetches the
                            Market Intelligence API and renders the
                            Bloomberg-style terminal layout.
  api/
    market-overview/        GET → MarketOverview
    sectors/                GET → SectorTrend[]
    regions/                GET → RegionTrend[]
    clusters/               GET → MarketCluster[]
    companies/              GET → CompanyProfile[]
    company/[id]/           GET → CompanyAggregate
    signals/                GET → CompanySignal[]
    score/                  GET → HiringScoreResult (?companyId=…)
    predictions/            GET → HiringPrediction[]
components/                 Dashboard UI (terminal-grade Tailwind).
lib/
  types.ts                  Codex domain model (canonical).
  scoring.ts                Codex scoring engine.
  mockData.ts               Codex mock data plumbed through the
                            ingestion pipeline.
  marketView.ts             View-model layer: CompanyAggregate → CompanyView.
  marketIntelligence.ts     Market Intelligence client + presentation maps.
  uiContracts/market.ts     Typed API response shapes.
  format.ts                 Display helpers + strength/confidence/forecast styles.
  uiMockData.ts             Sidebar / watchlist scaffolds (UI chrome only).
src/                        Ingestion + market engine internals (Codex).
adapters/                   Hermes / n8n / MiroFish adapter shells (Codex).
docs/                       Engine + UI documentation.
```

## Surface map

- **MarketOverviewHeader** — 7-up market tape from `/api/market-overview`.
- **SectorIntelligencePanel** — `/api/sectors`, top-3 hottest cards + table.
- **RegionIntelligencePanel** — `/api/regions`, DE focus chip on DACH/Germany.
- **MarketClusterView** — `/api/clusters`, sector × region heatmap with
  Opportunity / Risk / Score modes.
- **CompanySignalTable** — `/api/companies` + `/api/company/[id]` stitched
  client-side into the company radar.
- **CompanyDetailPanel** — score, confidence, drivers, signal stream from
  the selected company aggregate.
- **ForecastPanel** — `latestPrediction.expectedRoleClusters` and forecast
  band visualisation.
- **SignalTimeline** — 90-day signal histogram with negative-flag overlay.
- **ArchitectureFlow** — Sources → n8n → Hermes → Codex → Radar → MiroFish.
- **EmptyStates / LoadingSkeletons** — terminal-grade fallbacks.

## Design system

- Dark institutional palette (`bg-base` `#06070A` … `accent-cyan` `#22D3EE`,
  `accent-violet` `#A78BFA`, `accent-red` `#F87171`).
- JetBrains Mono for all numerics; Inter for UI.
- Density: 11.5–13px body, 10px eyebrows in 0.18em tracking.
- See `docs/UI_SYSTEM.md` and `docs/DASHBOARD_UX.md`.

## Read-only intelligence

The dashboard never writes anywhere. There are no candidate, applicant,
outreach, CRM, e-mail, or sequencing surfaces. All four guarantees are
visible in the architecture footer.
