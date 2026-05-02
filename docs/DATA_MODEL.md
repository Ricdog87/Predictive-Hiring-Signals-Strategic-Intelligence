# Data Model

The MVP is built around two core entities: **Company** and **HiringSignal**.
Both are defined in [`lib/types.ts`](../lib/types.ts) and are the contract any
real data source (Hermes, n8n) must satisfy.

## Entity: `Company`

A tracked organisation in the radar.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable internal identifier |
| `name` | `string` | Display name |
| `domain` | `string` | Primary web domain |
| `industry` | `Industry` | Enum, see below |
| `region` | `Region` | Enum, see below |
| `headquarters` | `string` | Free-text city + country |
| `employees` | `number` | Latest LinkedIn / Crunchbase headcount |
| `employeeGrowth90d` | `number` | Percent change in headcount over 90 days |
| `openRoles` | `number` | Currently posted roles |
| `rolesGrowth30d` | `number` | Percent change in posted roles over 30 days |
| `fundingStage` | enum | Seed → Public, plus Bootstrapped |
| `lastFundingAmountM` | `number` | Last round size, USD millions |
| `lastFundingMonthsAgo` | `number` | Months since last round |
| `techStackShifts` | `number` | Distinct stack changes in last 90 days |
| `leadershipChanges90d` | `number` | C-level / VP changes in last 90 days |
| `signals` | `HiringSignal[]` | Stream of detected signals |
| `description` | `string` | Short analyst-facing summary |
| `predictedHiringWindowDays` | `number` | Modeled days until the next hiring window opens |
| `predictedRolesNext90d` | `number` | Modeled roles to be opened in next 90 days |

### `Industry`

`SaaS | Fintech | Healthtech | AI/ML | Logistics | Cybersecurity | E-Commerce | Climate Tech`

### `Region`

`DACH | Nordics | UK & Ireland | BeNeLux | Iberia | North America`

## Entity: `HiringSignal`

A single observation that contributes to a company's score. Signals are
captured raw (with source + confidence) so the UI can show *why* a score
moved.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable identifier |
| `category` | `SignalCategory` | See below |
| `title` | `string` | One-line human-readable summary |
| `detectedAt` | `string` | ISO timestamp |
| `source` | `string` | E.g. "LinkedIn Jobs", "Crunchbase", "Engineering Blog" |
| `confidence` | `number` | 0–1 |
| `delta` | `number` | Momentum delta the signal contributed |

### `SignalCategory`

| Value | Meaning |
|---|---|
| `hiring_velocity` | Burst in posted roles or recruiter activity |
| `leadership_change` | New / departing C-level or VP |
| `funding_round` | New funding round announced |
| `tech_stack_shift` | Adoption of a meaningfully new stack component |
| `office_expansion` | Announced new office or region |
| `layoff_pivot` | Headcount contraction or strategic pivot |

## Derived: `ScoredCompany`

Output of `scoreCompany(company)`:

| Field | Type | Notes |
|---|---|---|
| `score` | `number` | Predictive Hiring Score, 0–100 |
| `strength` | `SignalStrength` | `weak \| moderate \| strong \| critical` |
| `topDrivers` | `{ label: string, weight: number }[]` | Top 3 contributing drivers, weights sum to ≤ 100 |

## UI state: `FilterState`

| Field | Type |
|---|---|
| `search` | `string` |
| `industries` | `Industry[]` |
| `regions` | `Region[]` |
| `minScore` | `number` (0–100) |
| `category` | `SignalCategory \| "all"` |

## Data quality assumptions (for v1 mock)

- Every company has at least one signal.
- Percent fields can be negative (contraction).
- `predictedHiringWindowDays` and `predictedRolesNext90d` are pre-computed in
  the mock; in v0.2 these will come out of Hermes alongside the score.
