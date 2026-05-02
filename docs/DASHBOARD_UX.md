# Dashboard UX

The Hiring Radar is a **company-side intelligence terminal**. Every surface
in the dashboard is built around three questions an analyst asks:

1. *Which companies should I look at right now?*
2. *Why? — what's driving their score, and how confident is the signal?*
3. *When will the hiring window open, and what roles will it open for?*

There are no candidate, applicant, matching, outreach, or CRM surfaces.

## Layout

Desktop-first, three-column shell:

```
┌──────────────────┬─────────────────────────────────────────────────┐
│ IntelligenceSide │ MarketPulseHeader (sticky)                      │
│   workspace nav  │ ┌─ pulse cells (6) ──────────────────────────┐  │
│   data sources   │ └─ ticker strip ────────────────────────────┘  │
│   confidence /   │                                                 │
│   score legend   │ Filter Console                                  │
│   engine status  │                                                 │
│                  │ Company Signal Radar │ Company Detail Inspector │
│                  │  (12-col table)      │  (sticky panel)          │
│                  │                                                 │
│                  │ Forecast · Predicted Role Clusters              │
│                  │                                                 │
│                  │ Sector Pulse                                    │
│                  │                                                 │
│                  │ Signal Timeline · 90 days                       │
│                  │                                                 │
│                  │ Watchlists                                      │
│                  │                                                 │
│                  │ Architecture Flow                               │
└──────────────────┴─────────────────────────────────────────────────┘
```

## Interaction model

- **Filter Console** drives every section below it. State is held in
  `app/page.tsx`. `MarketPulseHeader` recomputes from filtered companies so
  pulse numbers reflect the current query.
- **Selection**: clicking a row in the radar selects a company; the inspector
  and the Forecast panel snap to that company. Clicking the same row again
  deselects.
- **Inspector** stays sticky at top:160px so analysts can scroll the table
  without losing context.
- **Empty states** are first-class. Both the table and the inspector have
  their own empty surfaces with action affordances (clear filters / pick a
  row).

## Score reading order

For every company an analyst's eye should land in this order:

1. **Strength chip** (Critical / Strong / Moderate / Weak) — categorical
2. **Hiring Score** number (PHS 0–100) — magnitude
3. **Confidence** number (CONF 0–100) — trust
4. **Forecast band** chip (Imminent / Near / Mid / Watch) — when
5. **Top driver** (single line) — why
6. **Flags** — restructuring / layoff risk if present

The dual-ring `HiringScoreBadge` makes this quick: outer ring is score
(strength tone), inner ring is confidence (tone-coded by trust band). The
center number is the score; small footer reads `PHS · CONF n`.

## Negative signals

Three signals trigger a "restructuring risk" treatment:

- A `layoff_pivot` signal in the company's stream
- `rolesGrowth30d` < −5%
- `employeeGrowth90d` < −2%

Treatment:
- Red bracket on the radar row
- Red `Risk` chip in flags
- Red `Restructuring risk` chip in inspector header
- Red bar overlay in the timeline histogram for layoff buckets
- Forecast panel surfaces a banner explaining the projection caveat

## Keyboard / power-user hints

Visual hints already present:

- `⌘K` search affordance in header
- `⌘F` query console eyebrow

These are **scaffolding** — they're not yet wired to handlers. See
`docs/NEXT_UI_STEPS.md` for the implementation plan.

## Density rules

- Default row height in the radar: ~40px (2-line cells).
- Cells with two stats (e.g. company name + domain) stack with the secondary
  in mono 10px.
- Every numeric column right-aligns and uses `.num` (tabular mono).
- Eyebrow labels are 10px / 0.18em tracking. Section titles are 15px / 600.

## Accessibility considerations

- Color is never the only encoding: every color has a textual label or shape
  (chip text, dot + label).
- Selected rows show both color and a left bracket bar.
- Min font size: 10px for eyebrows, 11.5px for body text.
- Score and confidence are exposed both as numbers and as bars.

## Out of scope

- Candidate, applicant, talent profiles
- Outreach, e-mail, CRM, sequencing
- Multi-tenant accounts, billing
- Live external API calls (mock dataset only at v0.2)
