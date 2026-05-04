# N8N Live Data Pipeline

End-to-end live ingest for the Hiring Radar dashboard. n8n is the
collector + classifier; the radar is the sink + display.

```
┌──────────────┐   06:00 CET     ┌──────────────────────┐
│   n8n cron   │────────────────▶│ Google Sheet · Sources│
└──────────────┘                 └──────────┬───────────┘
                                            │ active=true
                                            ▼
                                  ┌──────────────────┐
                                  │  HTTP fetch RSS  │
                                  └────────┬─────────┘
                                           ▼
                                  ┌──────────────────┐
                                  │  Parse + classify│
                                  │  + score         │
                                  └────────┬─────────┘
                                           ▼
                                  ┌──────────────────┐
                                  │  POST /api/ingest│ ◀── this repo
                                  └────────┬─────────┘
                                           ▼
                                  ┌──────────────────┐
                                  │  IngestLog Sheet │
                                  └────────┬─────────┘
                                           ▼
                                  ┌──────────────────┐
                                  │  Telegram summary│
                                  └──────────────────┘
```

## Surfaces shipped in this repo

| Path                                                    | Purpose                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `app/api/ingest/route.ts`                               | `POST` accepts a single signal or an array (max 100). `GET` returns the latest 50. Bearer-auth optional. |
| `app/api/ingest/recent/route.ts`                        | `GET ?limit=N` returns the latest N records (1–500).          |
| `lib/ingestStore.ts`                                    | Storage abstraction — Vercel KV / Upstash REST when env is set, in-memory ring buffer otherwise. Capped at 5 000 records. |
| `lib/mockData.ts`                                       | Live signals are merged with adapter signals before scoring, so the dashboard panels (sectors, regions, clusters, companies) see them immediately. |
| `docs/n8n/rsg-hiring-signals-live-ingest-v1.json`       | Importable n8n workflow.                                      |
| `docs/n8n/sources-template.csv`                         | Empty header for the `Sources` tab.                           |
| `docs/n8n/sources-sample.csv`                           | 8 real, public DACH RSS feeds for the first run.              |
| `docs/n8n/ingestlog-template.csv`                       | Empty header for the `IngestLog` tab.                         |
| `docs/n8n/sources-list.md`                              | Source registry + future expansion plan.                      |

## Ingest payload contract

```jsonc
POST /api/ingest        // single
POST /api/ingest        // array (≤ 100)
Content-Type: application/json
Authorization: Bearer <INGEST_TOKEN>   // optional, only if env is set

{
  "companyName": "SAP SE",
  "signalType":  "funding_grant",
  "source":      "newsroom_rss",
  "title":       "SAP receives €X million funding ...",
  "description": "...",
  "impact":      82,            // -100..100, clamped + rounded
  "confidence":  0.86,          // 0..1, values >1 are read as percent
  "observedAt":  "2026-05-04T05:00:00Z",
  "metadata": {
    "url":      "https://news.sap.com/...",
    "region":   "DACH · South",
    "industry": "Enterprise Software",
    "workflow": "rsg-hiring-signals-live-v1"
  }
}
```

### Allowed `signalType` values

`mna_buy`, `mna_sell`, `gf_change`, `patent_filing`, `location_expansion`,
`funding_grant`, `press_release`, `restructuring`, `insolvency`,
`job_spike`, `employee_growth`, `product_launch`, `new_business_unit`.

Common aliases are normalised: `expansion` → `location_expansion`,
`funding` → `funding_grant`, `patent` → `patent_filing`,
`leadership_change` → `gf_change`, etc.

### Response

```jsonc
// 200 OK — at least one signal accepted
{
  "ok": true,
  "accepted": 4,
  "rejected": 1,
  "results": {
    "accepted": [
      { "id": "ing_xyz", "signalType": "funding_grant", ... }
    ],
    "rejected": [
      { "index": 2, "errors": ["signalType \"foo\" not recognized; ..."] }
    ]
  },
  "store": "kv",                  // "kv" | "memory"
  "generatedAt": "2026-05-04T..."
}
```

`422` is returned when **all** items in a batch fail validation. `401` is
returned when `INGEST_TOKEN` is set on the radar but the request lacks
the matching `Authorization: Bearer …` header.

## Storage modes

The store auto-selects:

- **`kv`** — set both `KV_REST_API_URL` and `KV_REST_API_TOKEN` (Vercel KV
  or any Upstash Redis REST endpoint). Records live in a Redis list
  capped at 5 000 entries (`LPUSH` + `LTRIM`).
- **`memory`** — module-level ring buffer pinned to `globalThis`, survives
  warm lambda invocations. Sufficient for preview deploys and local dev.
  **Not** sufficient for production multi-instance fan-out.

The active mode is reported in every `/api/ingest` response (`store` field).

## How live signals reach the dashboard

`lib/mockData.ts` merges `listIngest()` output with the existing adapter
output before grouping, scoring and predicting. No API contract changes:

- `GET /api/companies` includes companies derived from live signals.
- `GET /api/company/[id]` returns aggregates that include live signals.
- `GET /api/signals` includes them.
- `GET /api/sectors`, `/api/regions`, `/api/clusters`,
  `/api/market-overview` recompute from the merged signal stream.

When a live signal references a company that **is not** in the company
master, the profile uses metadata's `industry` / `region` as fallback.
Only when both are missing does the dashboard show the explicit
`Unclassified Industry` / `Unclassified Region` labels — never the bare
literal `"unknown"`.

## n8n workflow internals

Imported as `RSG Hiring Signals Live Ingest v1`. Stays in **draft**
(`active: false`) until you wire credentials and toggle activation
manually.

| Node                              | Role                                                             |
| --------------------------------- | ---------------------------------------------------------------- |
| `Cron · 06:00 CET daily`          | Schedule trigger.                                                |
| `Set · Run Globals`               | Resolves `INGEST_URL`, `INGEST_TOKEN`, sheet id, telegram id from env. |
| `Google Sheets · Read Sources`    | Reads the `Sources` tab.                                         |
| `Filter · active=true`            | Keeps only enabled sources.                                      |
| `Loop Over Sources`               | One iteration per source — failures are isolated.                |
| `HTTP · Fetch RSS / Newsroom`     | `continueOnFail: true` + `neverError: true` — bad source ≠ broken run. |
| `Code · Parse Feed`               | Pure-JS RSS / Atom parser (no external deps), 14-day window.    |
| `Code · Classify + Score`         | Regex-driven classifier → 13 signal types; impact + confidence; press fallback only for press source types. |
| `Code · De-duplicate`             | Within-run dedup on (company, type, observedAt, title).         |
| `HTTP · POST /api/ingest`         | One POST per article, bearer-auth from globals.                  |
| `Code · Build Log Rows`           | Builds the IngestLog row (status + http code + truncated error). |
| `Google Sheets · Append IngestLog`| Appends per-article result row.                                  |
| `Code · Build Telegram Summary`   | Aggregates the run (totals, errors, top signal types).           |
| `Telegram · Daily Summary`        | One Markdown summary message per run — never per article.        |

### Required env vars in n8n

| Variable                       | Required | Notes                                                  |
| ------------------------------ | -------- | ------------------------------------------------------ |
| `HIRING_RADAR_INGEST_URL`      | yes      | e.g. `https://predictive-hiring-signals-strategic.vercel.app/api/ingest` |
| `HIRING_RADAR_INGEST_TOKEN`    | optional | Must match `INGEST_TOKEN` on the radar.                |
| `RSG_SOURCES_SHEET_ID`         | yes      | Google Sheet ID containing the `Sources` and `IngestLog` tabs. |
| `TELEGRAM_CHAT_ID`             | yes      | Where the daily summary lands.                         |

### Required credentials in n8n

- **Google Sheets OAuth2** — read `Sources`, append `IngestLog`. Replace `REPLACE_GS_CREDENTIAL_ID` after import.
- **Telegram** — bot token. Replace `REPLACE_TELEGRAM_CREDENTIAL_ID` after import.

## Production safety guarantees

1. **No auto-activation** — workflow ships with `"active": false`.
2. **No clobber** — workflow has a unique `versionId` and a unique name; existing workflows are untouched.
3. **No credential mutations** — workflow imports credential references by id but never edits or deletes the underlying credentials.
4. **Per-source isolation** — each source iterates inside `Loop Over Sources`. `continueOnFail: true` on every external call ensures one bad RSS feed cannot kill the run.
5. **Daily summary only** — Telegram fires once per run, aggregated. No per-article spam.
6. **Idempotent ingest** — the radar's store hashes `(source, companyName, signalType, observedAt, title)` into the record id; re-posting the same article overwrites in place rather than duplicating.
7. **Rejection over corruption** — invalid payloads return `422` and are written to `IngestLog` with status `error`, never silently dropped into the dashboard.

## Local smoke test

```bash
# 1. Start the radar
npm run dev

# 2. Post a synthetic live signal
curl -sX POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{
    "companyName": "Apex Dynamics",
    "signalType":  "funding_grant",
    "source":      "manual_test",
    "title":       "Smoke test funding signal",
    "description": "Synthetic test payload from curl",
    "impact":      72,
    "confidence":  0.84,
    "observedAt":  "2026-05-04T05:00:00Z",
    "metadata":    { "url": "https://example.local", "workflow": "manual" }
  }' | jq

# 3. Verify it landed in the recent ring
curl -s http://localhost:3000/api/ingest/recent?limit=5 | jq

# 4. Verify it now shows up in the company aggregate
curl -s http://localhost:3000/api/company/comp_001 | jq '.data.signals | length'
```

## Activation checklist

See `docs/N8N_ACTIVATION_CHECKLIST.md`.
