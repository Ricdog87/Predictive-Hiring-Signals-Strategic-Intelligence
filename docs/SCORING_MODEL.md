# Scoring Model — Predictive Hiring Score (PHS)

The Predictive Hiring Score is a single 0–100 number per company that
estimates the likelihood and magnitude of a hiring window opening in the next
30–90 days. It is produced by [`lib/scoring.ts`](../lib/scoring.ts).

## Design goals

1. **Transparent** — every score must be explainable by a small set of named
   drivers.
2. **Single source of truth** — all weights and normalization live in one
   file, so changes propagate to every consumer.
3. **Replaceable** — the function signature is `Company -> ScoredCompany`. It
   can be lifted into Hermes without touching the UI.
4. **Tunable** — weights are constants, not magic numbers buried in code.

## Components

Each input is normalized into `[0, 1]` before being weighted.

| Component | Weight | Normalization |
|---|---:|---|
| Open-roles momentum (30d) | 0.22 | `clamp01(pct / 60)` |
| Headcount growth (90d) | 0.16 | `clamp01(pct / 40)` |
| Funding recency | 0.18 | `clamp01(1 - monthsAgo / 18)` |
| Funding size | 0.10 | `clamp01(millions / 150)` |
| Leadership changes (90d) | 0.10 | `clamp01(count / 4)` |
| Tech stack shifts (90d) | 0.08 | `clamp01(count / 6)` |
| Active open roles | 0.08 | `clamp01(count / 80)` |
| Combined signal density | 0.08 | `clamp01(signals / 6)` |

Weights sum to **1.00**. The final score is `round(raw × 100)`.

## Strength bands

| Band | Range |
|---|---|
| `critical` | 80–100 |
| `strong` | 65–79 |
| `moderate` | 45–64 |
| `weak` | 0–44 |

Bands map to UI styling via `lib/format.ts → strengthStyles`.

## Why these inputs

- **Open-roles momentum** is the strongest near-term hiring signal — it
  reflects budgets that have already moved.
- **Headcount growth** captures the trailing reality and disambiguates
  short-term role spikes from sustainable scaling.
- **Funding recency / size** dominate medium-term hiring windows — most
  rounds drive a 60–120 day hiring sprint.
- **Leadership changes** trigger targeted hiring under the new leader.
- **Tech stack shifts** correlate with platform / infra hiring.
- **Active open roles** is a level signal, not just momentum, and prevents
  small-base outliers from dominating the radar.
- **Signal density** rewards companies showing *multiple* concurrent signals
  over those with one strong one.

## Top drivers

For each scored company we expose the top 3 contributing components (by
weighted contribution to the raw score). The detail panel renders these as
horizontal bars so an analyst can sanity-check the score in seconds.

## Calibration plan (post-MVP)

The current weights are heuristics tuned for visual sensibility on the mock
dataset. Once Hermes is wired up:

1. **Backtest** — for a set of companies with known hiring windows, compute
   PHS at `t-90d` and measure correlation with `roles_opened[t-90d, t]`.
2. **Re-fit weights** — solve for weights that maximize rank correlation
   under the existing normalization, using a constrained logistic or simple
   linear regression.
3. **Stratify** — fit separate weight vectors per industry and per region
   when sample size allows. Industries differ meaningfully (e.g. Climate Tech
   funding rounds drive different hiring shapes than AI/ML).
4. **Confidence intervals** — propagate signal-level confidence into a score
   confidence band so the UI can flag low-trust scores.

## Adding a new signal

1. Add a field to `Company` in `lib/types.ts`.
2. Add a `norm.<field>` and a weight in `SCORING_WEIGHTS` in `lib/scoring.ts`.
3. Add a label in the `driverLabels` map.
4. Re-balance weights so they sum to 1.

Nothing else should need to change.
