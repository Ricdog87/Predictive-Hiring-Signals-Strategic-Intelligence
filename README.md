# RSG Predictive Hiring Radar

Strategic intelligence dashboard that surfaces **predictive hiring signals** for
companies across industries and regions. The radar highlights organisations
that are statistically likely to open hiring windows in the next 30–90 days,
based on a transparent scoring model over public market signals.

> MVP scope: Next.js dashboard with mock data. **No HubSpot. No e-mail. No
> outreach. No external APIs.** Pure predictive intelligence frontend.

---

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **TailwindCSS** with a custom dark "intelligence" theme
- Pure client-side state — no DB, no auth, no integrations in v1
- Scoring logic is isolated in `lib/scoring.ts` so it can be extracted into a
  service later

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Other scripts:

```bash
npm run build       # production build
npm run start       # serve production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
```

## Project structure

```
app/                Next.js App Router entry (layout, page, globals.css)
components/         Dashboard UI components (KPI cards, filters, table, panel)
lib/
  scoring.ts        Predictive Hiring Score (PHS) — single source of truth
  mockData.ts       Mock company + signal dataset
  types.ts          Domain types
  format.ts         Display helpers + category/strength styling
docs/
  PRODUCT_BRIEF.md  Product framing, users, jobs-to-be-done
  ARCHITECTURE.md   System architecture (current + target)
  DATA_MODEL.md     Domain entities and field semantics
  SCORING_MODEL.md  PHS weights, normalization, calibration plan
  NEXT_STEPS.md     Roadmap towards Hermes / n8n / MiroFish integration
```

## What the dashboard shows

- **KPI cards** — tracked companies, critical signals, average PHS, predicted
  90d roles
- **Filter bar** — search, min PHS slider, signal category, industry & region
  multi-select
- **Hiring Signal Radar table** — companies sorted by PHS, with strength
  badges, roles momentum, predicted 90d hiring volume, and the top driver
- **Company Detail Panel** — score breakdown, top drivers, recent signals,
  predicted hiring window, leadership and tech-stack movement

## Roadmap (high level)

The MVP is intentionally a self-contained UI. The next phases plug it into the
RSG ecosystem:

1. **Data ingestion** via n8n — LinkedIn Jobs, Crunchbase, press signals
2. **Hermes** as the storage + scoring service backing the dashboard
3. **MiroFish** integration to surface intelligence inside collaborative
   strategy boards

See [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) for the detailed plan.
