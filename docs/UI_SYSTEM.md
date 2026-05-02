# UI System

The Predictive Hiring Radar is a **dark institutional intelligence terminal**.
This document captures the design tokens, component inventory, and rules a
designer / engineer needs to keep new surfaces visually consistent.

## Aesthetic principles

1. **Dense but readable.** Information density beats whitespace; every pixel
   should be earning its keep.
2. **Calm before color.** Monochrome by default, color used only to encode
   meaning (score, confidence, momentum, attention).
3. **Mono for numerics.** All numbers use JetBrains Mono with `tnum` features
   enabled so they align in tabular layouts.
4. **Show your work.** Every score is paired with a confidence indicator and
   the drivers that produced it.
5. **Read-only intelligence.** No outbound, no CRM, no e-mail. The header
   ribbon repeats this commitment.

## Color tokens (Tailwind)

Background scale (deep → elevated):

| Token | Hex | Use |
|---|---|---|
| `bg-bg-base` | `#06070A` | App background |
| `bg-bg-surface` | `#0B0D12` | Sidebar, ticker |
| `bg-bg-panel` | `#0F1218` | Panels, cards |
| `bg-bg-elevated` | `#141822` | Hover states |
| `bg-bg-border` | `#1B2030` | Hairline borders |
| `bg-bg-line` | `#222838` | Divider lines |
| `bg-bg-rule` | `#2A3142` | Vertical rules / muted ring |

Accent palette (semantic):

| Token | Hex | Encodes |
|---|---|---|
| `accent-cyan` | `#22D3EE` | Strong score, primary actions |
| `accent-violet` | `#A78BFA` | Critical score, imminent forecast |
| `accent-green` | `#34D399` | Positive momentum, high confidence |
| `accent-amber` | `#FBBF24` | Moderate score, low confidence |
| `accent-red` | `#F87171` | Negative signals, restructuring risk |
| `accent-ink` | `#7DD3FC` | Mid confidence, neutral signals |

Text:

| Token | Hex |
|---|---|
| `text-text-primary` | `#E6E8EE` |
| `text-text-secondary` | `#9AA3B2` |
| `text-text-muted` | `#5A6478` |
| `text-text-faint` | `#3A4154` |

## Typography

- **Sans:** Inter (UI labels, body)
- **Mono:** JetBrains Mono (numbers, identifiers, eyebrows, ticker)
- **Eyebrow style** (`label-eyebrow`): 10px, uppercase, letter-spacing 0.18em,
  `font-mono`, `text-text-muted`. Used as section/eyebrow labels.
- **Tabular numerics:** all numeric output uses `font-mono tabular-nums` (the
  `.num` utility).

## Surface primitives

Defined in `app/globals.css`:

- `.panel` — base panel: rounded-md, hairline border, soft inner shadow.
- `.panel-header` — flex row, hairline bottom border, padded for eyebrow titles.
- `.label-eyebrow` — small uppercase label.
- `.num` — tabular monospace numbers.
- `.chip` — pill chip with ring (used for strength, forecast band, confidence).
- `.bracket-l` — left vertical cyan accent on section titles.
- `.bg-grid` + `.bg-grid-fade` — subtle scan-grid background with radial mask.
- `.divide-rule` — `border-top` rule between siblings.
- `.terminal-rule` — gradient hairline divider.

## Component inventory (v0.2 · ui-terminal-v2)

| Component | Purpose |
|---|---|
| `MarketPulseHeader` | Top sticky header with breadcrumb, UTC clock, market pulse cells, ticker |
| `IntelligenceSidebar` | Workspace nav, data sources, confidence/score legends, engine status |
| `FilterBar` | Query console: search, score floor, signal-type, sector + region pills |
| `CompanySignalTable` | 12-column dense radar table with score bars, confidence, forecast, flags |
| `CompanyDetailPanel` | Inspector with `HiringScoreBadge`, drivers, stats grid, signal timeline |
| `HiringScoreBadge` | Dual-ring SVG — outer = Hiring Score, inner = Confidence |
| `ForecastPanel` | Forecast band slider + predicted role clusters (UI projection) |
| `SectorOverview` | Sector aggregate cards (avg PHS, confidence, momentum, risk flags) |
| `WatchlistPanel` | Curated cohort scaffold with sparkline trends |
| `SignalTimeline` | 90-day histogram with negative overlay + recent stream + per-category volume |
| `ArchitectureFlow` | Sources → n8n → Hermes → Codex → Radar → MiroFish, "you are here" |
| `EmptyStates` | Table / inspector / panel empty states with terminal grid bg |
| `LoadingSkeletons` | Shimmer skeletons for KPI / table / inspector |

## Score & confidence semantics

| Hiring Score band | Range | Tone |
|---|---|---|
| Critical | 80–100 | violet |
| Strong | 65–79 | cyan |
| Moderate | 45–64 | amber |
| Weak | 0–44 | muted |

| Confidence band | Range | Tone |
|---|---|---|
| High | ≥ 80 | green |
| Medium | 50–79 | ink (light cyan) |
| Low | < 50 | amber |

| Forecast band | Window | Tone |
|---|---|---|
| Imminent | ≤ 30d | violet |
| Near-term | 31–60d | cyan |
| Mid-term | 61–90d | amber |
| Watch | > 90d | muted |

Hiring Score and Confidence are **rendered as separate channels**. They
should never be combined into a single number on screen — analysts must be
able to distinguish a low-confidence high score from a high-confidence
moderate score at a glance.

## Negative-signal handling

Companies flagged via `isNegativeCompany()` (layoff/pivot signal, contracting
roles, contracting headcount) get:

- a red `Risk` chip in the table flags column
- a red bracket on the row indicator
- a `NegativeSignalChip` in the inspector header
- a red bar overlay in the signal-timeline histogram for layoff events

Forecast windows for these companies remain visible but the inspector calls
out that the projection may not represent net hiring.

## Don'ts

- Don't introduce gradients beyond the existing radial grid mask and the
  `panel-gradient` header tint.
- Don't introduce new fonts.
- Don't add color encodings for non-semantic decoration.
- Don't render scores without their confidence.
- Don't add candidate/applicant/outreach surfaces — this is a read-only
  company-side intelligence terminal.
