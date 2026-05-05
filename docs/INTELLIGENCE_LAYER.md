# Intelligence Layer · v2

End-to-end map of every data source, classification step, and aggregation
the Hiring Radar uses to produce its intelligence. Built for two audiences:

1. **Internal recruiters** opening the dashboard.
2. **External SaaS subscribers** (next milestone) hitting `/api/intel/snapshot`
   with an API key.

```
                    ┌──────────────────────────────────────┐
                    │             /api/intel/snapshot      │  ◀── single SaaS endpoint
                    │            (API-key gated)           │
                    └──────────────────┬───────────────────┘
                                       │ aggregates
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
   Internal radar state       Live macro sources         Job-market sources
   (live ingest store +       (free, no-auth APIs)       (Adzuna, env-driven)
    adapter signals)
              │                        │                        │
              ▼                        ▼                        ▼
   /api/sectors                /api/macro/*              /api/jobmarket/pulse
   /api/regions                /api/regions/de
   /api/regions/de             /api/news/feed
   /api/companies              /api/ticker
   /api/opportunities/top
   /api/signals/deduped
   /api/sources/health
```

## 1. Live macro sources (no auth required)

| Endpoint                          | Source                  | Indicator                                   | Cache  | Used by                       |
|-----------------------------------|-------------------------|---------------------------------------------|--------|-------------------------------|
| `GET /api/macro/de-unemployment`  | Eurostat `une_rt_m`     | DE unemployment rate · monthly · SA · % of active pop | 6h | Welcome banner, ticker        |
| `GET /api/macro/inflation`        | ECB SDW `ICP/M.DE`      | DE HICP inflation · annual rate of change   | 6h     | Snapshot                      |
| `GET /api/macro/ecb-rate`         | ECB SDW `FM/D.U2.EUR.4F.KR.MRR_FR.LEV` | ECB main refinancing rate · daily | 1h | Snapshot |
| `GET /api/macro/job-vacancy`      | Eurostat `jvs_q_nace2`  | DE job vacancy rate · quarterly · SA · NACE B–S | 6h | Snapshot |
| `GET /api/macro/employment`       | Eurostat `lfsi_emp_q`   | DE employment rate · 15–64 · quarterly · SA | 6h     | Snapshot                      |
| `GET /api/macro/cli`              | OECD MEI `LOLITONO.DEU` | DE Composite Leading Indicator · monthly    | 6h     | Snapshot                      |
| `GET /api/regions/de`             | Eurostat `lfst_r_lfu3rt` (overlay) | DE NUTS-1 unemployment per Bundesland | 6h | Germany Region Panel |

Every macro endpoint follows the same response shape:
```jsonc
{ "ok": true, "rate": 4.2, "period": "2026-03", "source": "eurostat",
  "indicator": "une_rt_m · DE · TOTAL · PC_ACT · SA",
  "fetchedAt": "...", "generatedAt": "..." }
```
Failure → `{ "ok": false, "reason": "timeout|http_error|parse_error|network", "detail": "…" }` with a `200` status. The dashboard never breaks on a macro outage.

## 2. Live job-market source (Adzuna · env-gated)

| Endpoint                        | Source              | Notes |
|---------------------------------|---------------------|-------|
| `GET /api/jobmarket/pulse`      | Adzuna DE           | Per-category job count + median salary + top employers + top cities |

ENV (none = endpoint returns `{ ok:false, configured:false, reason:"unconfigured" }`):
```
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
```
Free tier at https://developer.adzuna.com/. Categories curated to map onto our
internal sector taxonomy (`it-jobs`, `engineering-jobs`, `sales-jobs`,
`finance-jobs`, `manufacturing-jobs`, `logistics-warehouse-jobs`,
`healthcare-nursing-jobs`, `consultancy-jobs`, `hr-jobs`, …).

## 3. News / wire feed

| Endpoint                | Sources (RSS / Atom, no auth)                     | Refresh |
|-------------------------|---------------------------------------------------|---------|
| `GET /api/news/feed`    | Tagesschau Wirtschaft + Eilmeldungen, Spiegel Wirtschaft + Eilmeldungen + Top, Zeit Wirtschaft, WirtschaftsWoche, Manager Magazin (incl. Unternehmen) | 5 min |

The wire feed runs each headline through:
1. **`extractEntity`** — ~80 curated DACH/global entities + a wildcard
   suffix matcher (`X AG / GmbH / SE / KGaA / Inc / Corp / Ltd / Holding /
   Group / SA / NV / BV`). Aliases sorted longest-first.
2. **`classifySignal`** — same 13-type taxonomy as `/api/ingest`:
   `mna_buy`, `mna_sell`, `gf_change`, `patent_filing`, `location_expansion`,
   `funding_grant`, `press_release`, `restructuring`, `insolvency`,
   `job_spike`, `employee_growth`, `product_launch`, `new_business_unit`.
3. **Cluster-by-(entity × signalType)** — corroborated by multiple wires,
   most-trusted source becomes the master, others surface via
   `corroboratingSources[]`.
4. **`breaking` flag** = severity (M&A / insolvency / restructuring / funding
   / leadership) AND age ≤ 12 h.

The `/api/ticker` endpoint folds these classified items into the marquee
strip, sorted with breaking news first. The `BreakingNewsStrip` component
polls every 5 minutes and animates new arrivals.

## 4. Internal signals (radar's own stream)

| Endpoint                      | Notes                                                |
|-------------------------------|------------------------------------------------------|
| `POST /api/ingest`            | Bearer-auth via `INGEST_TOKEN`. Single or batch (≤100).  |
| `GET  /api/ingest/recent`     | Last 50 with `?limit=` 1..500.                       |
| `GET  /api/signals`           | Merged adapter + live ingest stream.                 |
| `GET  /api/signals/deduped`   | Token-Jaccard collapse (company × type × 14d).       |

Live signals from n8n flow through the same classifier as the news pipeline,
so `/api/ingest` and `/api/news/feed` produce semantically identical
records — opportunity scoring and sector / region aggregation
treat them identically.

## 5. Hermes (LLM analysis · Hostinger)

| Endpoint (Radar proxy)                  | Hermes upstream         | Tier  | Default model               |
|-----------------------------------------|-------------------------|-------|-----------------------------|
| `POST /api/hermes/analyze-signal`       | `/analyze-signal`       | fast  | `openai/gpt-4o-mini`        |
| `POST /api/hermes/opportunity-brief`    | `/generate-opportunity-brief` | deep | `anthropic/claude-3.5-haiku` |
| `POST /api/hermes/regional-insight`     | `/regional-insight`     | live  | `perplexity/sonar` (web grounded) |
| `GET  /api/hermes/health`               | `/health`               | —     | —                           |

The `live` tier uses Perplexity Sonar with web search to ground answers in
current sources (Bundesagentur, IHK, Handelsblatt, etc.). Per-tier
guardrails (`HERMES_RPM_*`, `HERMES_RPD_*`) cap usage; tripped caps return
a graceful deterministic fallback, never a 5xx.

## 6. Unified snapshot · `/api/intel/snapshot`

The single endpoint a SaaS subscriber needs. Returns a JSON document
covering:

```jsonc
{
  "ok": true,
  "auth": { "enforced": true, "keyId": "key_pro_acme" },
  "schemaVersion": "1.0",
  "generatedAt": "...",
  "market":   { "totalSignals":..., "averageHiringScore":..., "highProbabilityCompanies":..., "newSignals24h":..., "positiveGrowthSignals":..., "negativeRiskSignals":... },
  "macro":    { "deUnemployment": {ok, rate, period},  "deInflation":{...}, "ecbRate":{...},
                "deJobVacancyRate":{...}, "deEmploymentRate":{...},
                "deCompositeLeadingIndicator":{ok, value, period, trend} },
  "regions":  { "quadrants": [{id,label,hiringRate,momentum30d,…}],
                "topBundeslaender":[{code,name,quadrant,hiringRate,unemploymentRate,…}] },
  "sectors":  [{ sector, companyCount, signalVolume, averageScore, momentum, trendDirection }],
  "opportunities": [{ companyId, companyName, opportunityScore, confidence, topSignals, recommendedTiming, whyNow }],
  "breakingNews":  [{ company, signalType, title, source, link, publishedAt, breaking }],
  "jobMarket": { "ok": true, "totalPostings":..., "byCategory":[...], "topCompaniesAcross":[...] }
}
```

Query params:
- `topN=10` (1..50) — how many opportunities to include.
- `news=8` (1..30) — how many breaking-news items to include.
- `lite=1` — skip live web fetches (only return the radar-side pieces).

## 7. SaaS API-key gating

`lib/apiKeys.ts` provides a tiny in-process gate. It activates only when
`EXTERNAL_API_KEYS` is set:

```
EXTERNAL_API_KEYS="key_demo:60,key_pro_acme:600,key_enterprise:6000"
```

Format: comma-separated `key:hourlyQuota`. Default quota when omitted is
60 req/h (`EXTERNAL_API_DEFAULT_QUOTA`).

Currently only `/api/intel/snapshot` is gated — internal endpoints stay
open for the dashboard. When billing goes live, any new "premium"
endpoint adds two lines:
```ts
const auth = checkApiKey(req);
const denied = denyResponseFor(auth);
if (denied) return denied;
```
Every response carries `X-RSG-Quota-Limit / Used / Reset` headers when
auth is enforced. The implementation is in-process — when we move to
multi-region / billing, swap one module for a Redis-backed store, no
call-site changes needed.

## 8. n8n workflow v2

`docs/n8n/rsg-hiring-signals-live-ingest-v2.json` — drop-in replacement
for v1. Adds:

- **Parallel Hermes hop** — every accepted signal also fires
  `POST /api/hermes/analyze-signal` from the same loop iteration. Result
  (intent, urgency, riskFlag, summary) is written into the IngestLog
  alongside the original signal.
- **Daily digest cron** (08:00 CET) — calls `/api/intel/snapshot?topN=5&news=6`
  with `INTEL_API_KEY`, formats a Markdown summary covering market /
  macro / quadrants / top opportunities / wire feed, sends to Telegram.

ENV expected by the workflow:
- `HIRING_RADAR_BASE_URL` (default: Vercel preview URL)
- `HIRING_RADAR_INGEST_TOKEN` (matches radar `INGEST_TOKEN`)
- `HIRING_RADAR_INTEL_API_KEY` (one of the keys in `EXTERNAL_API_KEYS`)
- `RSG_SOURCES_SHEET_ID`
- `TELEGRAM_CHAT_ID`

## 9. Roadmap (next milestones)

- **Stripe-backed key store** — replace the env-driven map with KV / Postgres
  table keyed by Stripe customer id, expose self-service rotation.
- **EPO patent index** — add patent-filing-rate-per-Bundesland from EPO OPS
  (free with registration). Today a heuristic; tomorrow a real lead indicator.
- **Bundesagentur Jobsuche** — supplement Adzuna with the federal job
  registry once the API access is granted.
- **Persistent time series** — KV-backed history of every snapshot so
  Sparklines stop being synthetic and become real 30-day trajectories.
- **Per-tenant filtered snapshots** — query parameters to scope to a
  single Bundesland / sector / watchlist, billed at the same per-call rate.

## 10. Sources at a glance — what's actually live, today

| Source                | Auth      | Cost   | Latency | Coverage                     |
|-----------------------|-----------|--------|---------|------------------------------|
| Eurostat              | none      | free   | hours-day | DE unemployment + 16 Länder + vacancy rate + employment rate |
| ECB SDW               | none      | free   | minutes | EUR refinancing rate, DE HICP inflation |
| OECD MEI              | none      | free   | days     | DE Composite Leading Indicator |
| Tagesschau / Spiegel / Zeit / WiWo / Manager Magazin RSS | none | free | 5 min | DE business-wire headlines |
| Adzuna                | app_id+key | free tier | 30 min | DE job postings by category |
| Hermes / OpenRouter   | bearer    | metered | 5–25 s | LLM classification + briefs + Sonar live insight |
| Internal `/api/ingest` | bearer (optional) | free | live  | n8n RSS classifier output |
