# Market Dashboard UX

The Hiring Radar is now a **Market Intelligence Terminal** for the German /
DACH labour market. It surfaces three layers in order of decreasing zoom:

1. **Market** — what is the labour market doing right now?
2. **Sector & Region** — which slices of the market are heating up or cooling
   down, and where is Germany positioned?
3. **Cluster & Company** — which sector × region intersections (and which
   individual companies inside them) deserve attention now?

There are no candidate, applicant, matching, outreach, or CRM surfaces.

## Data plane

The UI consumes four typed contracts from `lib/uiContracts/market.ts`:

| Contract | Endpoint (Codex) | Component |
|---|---|---|
| `MarketOverview` | `GET /api/market-overview` | `MarketOverviewHeader` |
| `SectorTrend[]` | `GET /api/sectors` | `SectorIntelligencePanel` |
| `RegionTrend[]` | `GET /api/regions` | `RegionIntelligencePanel` |
| `MarketCluster[]` | `GET /api/clusters` | `MarketClusterView` |

Until those routes ship, `lib/marketIntelligence.ts` derives the same shapes
on the client from the scored mock dataset. The UI itself does not know
whether the data is derived or fetched — it only ever consumes the contract
types.

When the routes go live, four `fetch` calls in `app/page.tsx` (or a
`getMarketIntelligence()` wrapper) replace the four `derive*` calls, and the
UI is unchanged.

## Layout

Desktop-first, three-column shell. New sections sit above the company-side
surfaces so an analyst always lands on the macro picture first.

```
┌──────────────────┬─────────────────────────────────────────────────┐
│ IntelligenceSide │ MarketOverviewHeader (sticky)                   │
│   workspace nav  │  ┌─ 7-up MarketOverview cells ───────────────┐  │
│   data sources   │  └─ ticker (DE/DACH market) ────────────────┘  │
│   confidence /   │                                                 │
│   score legend   │ Sector Intelligence                             │
│   engine status  │   ┌ Top-3 hottest sector cards ──────────────┐  │
│                  │   └ Sector trend table (10 cols)             │  │
│                  │                                                 │
│                  │ Region Intelligence                             │
│                  │   ┌ Top-3 region cards (DE highlight) ────────┐ │
│                  │   └ Region tile grid (germanyShare on DACH)   │ │
│                  │                                                 │
│                  │ Sector × Region Cluster Heatmap                 │
│                  │   ┌ Mode toggle: opportunity / risk / score ─┐  │
│                  │   ├ Sector × Region matrix (heatmap cells)   │  │
│                  │   └ Selected-cluster inspector ──────────────┘  │
│                  │                                                 │
│                  │ Filter Console                                  │
│                  │ Company Signal Radar │ Company Detail Inspector │
│                  │ Forecast Panel                                  │
│                  │ Signal Timeline · 90 days                       │
│                  │ Architecture Flow                               │
└──────────────────┴─────────────────────────────────────────────────┘
```

## MarketOverviewHeader

The header is the "tape" — always visible, always recomputing from the
filtered query.

Cells (left → right):

1. Total signals (with new-24h sub-line)
2. High-probability companies (score ≥ 70)
3. Avg hiring score
4. Avg hiring window (days)
5. New signals · 24h
6. Positive growth signals (hiring + funding + expansion) — green accent bar
7. Negative risk signals (layoff / pivot) — red accent bar

Below the cells: a horizontally scrolling ticker of DE/DACH/UK sector
averages so the analyst feels market motion at a glance.

## SectorIntelligencePanel

- **Top-3 hottest sector cards**: rank, hottest company, avg score with bar,
  companies / signals / pred-roles mini stats.
- **Sector trend table** (10 columns): companies, avg score (mini bar),
  confidence (mini bar), signal volume (purple bar), pred. roles 90d (cyan
  gradient bar), momentum %, trend arrow, strongest signals (chips with
  share %), risk flags.

Score and momentum are shown as separate channels — never combined.

## RegionIntelligencePanel

- **Top-3 region cards** with a `DE focus` chip when DACH ranks.
- **Region tile grid**: each region renders as a heatmap-style card with
  score, momentum arrow, dominant sectors as chips, and — for DACH only —
  the `germanyShare` mini bar that shows how much of the DACH cohort is
  actually based in Germany. This is the dashboard's primary German-market
  affordance.

## MarketClusterView

The matrix is the "trading screen" of the terminal:

- Rows = sectors, columns = regions, cells = `MarketCluster` bubbles.
- Cell fill encodes `averageHiringScore` (intensity).
- Cells display: avg score, momentum arrow, company count, two inset dots
  for opportunityLevel / riskLevel.
- A mode toggle (Opportunity / Risk / Score) reweights the cell tinting.
- The DACH column header is rendered in cyan to keep the German market
  visually anchored.
- Below the matrix: a legend strip and a **Selected cluster** inspector that
  shows the chosen cell with `OpportunityBadge`, `RiskBadge`, dominant
  signals, and a 4-step `LevelBar`.

Selection is local state — clicking a cell sets it, default selection is the
first cluster.

## Risk / Opportunity badges & momentum arrows

Defined in `components/MarketBadges.tsx`:

- `OpportunityBadge` — encodes `Level` (low / medium / high / elevated). The
  `elevated` tier uses violet to read "structurally hot" rather than
  "panicked" red.
- `RiskBadge` — encodes `Level` with a red ramp at `high` / `elevated`,
  amber at `medium`, muted at `low`. Always pairs with the opportunity badge
  so the analyst can see both risk and reward.
- `MomentumArrow` — `▲` green, `→` muted, `▼` red, with optional value.
- `LevelBar` — 4-segment bar that fills up to the current `Level`.

## German-market focus

- `MarketOverviewHeader` shows `Market: DE · DACH` in the meta strip.
- `RegionIntelligencePanel` highlights DACH and surfaces the `germanyShare`
  for that region.
- `MarketClusterView` colors the DACH column header in cyan.
- The ticker leads with `DE · …` rows.

When the underlying data is enriched with per-country breakdowns, the
`germanyShare` becomes a first-class heatmap dimension and the cluster
matrix can split DACH into DE / AT / CH columns.

## Negative-signal handling

Negative signals (layoff_pivot or contracting roles/headcount) propagate
through every market surface:

- `MarketOverview.negativeRiskSignals` → red accent bar in the header
- `SectorTrend.negativeFlags` → red `Risk` chip in the sector table
- `RegionTrend.negativeFlags` → red `Risk flags` row in the region tile
- `MarketCluster.riskLevel` → `RiskBadge` in the cluster inspector + red
  inset dot in the matrix cell

## Out of scope

- Candidate / applicant / talent profile views
- Outreach, e-mail, CRM, sequencing
- HubSpot or any CRM-side write integration
- Live scraping inside the UI

The entire surface remains **read-only intelligence**.
