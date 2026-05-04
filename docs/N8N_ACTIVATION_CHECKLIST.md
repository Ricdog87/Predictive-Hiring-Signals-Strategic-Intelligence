# Activation Checklist · Live Hiring Signals

Walk through this in order. Do **not** skip steps 5–7.

## 0. Prerequisites

- [ ] Hiring Radar deployed on Vercel and reachable.
- [ ] n8n instance reachable: `https://n8n.srv986889.hstgr.cloud`.
- [ ] Telegram bot created, chat id known.
- [ ] Google Sheets OAuth credential already exists in n8n (or you can create one).

## 1. Radar — environment

In Vercel → project settings → environment variables:

- [ ] `INGEST_TOKEN` = a long random string (recommended, but optional).
      If unset, `/api/ingest` accepts unauthenticated POSTs. Fine for
      preview, *not* for production.
- [ ] (Optional, recommended) `KV_REST_API_URL` + `KV_REST_API_TOKEN` —
      hook up Vercel KV / Upstash Redis. Without it, the store falls back
      to per-instance memory, which loses data on cold starts and does
      not fan out across regions.

Redeploy after setting envs.

Smoke check the radar:

- [ ] `curl https://<radar>/api/ingest` returns `{"data":[],"count":0,...}`.
- [ ] Test POST returns `{"ok":true,"accepted":1,...}`:
      ```
      curl -sX POST https://<radar>/api/ingest \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer <INGEST_TOKEN>' \
        -d '{"companyName":"Apex Dynamics","signalType":"funding_grant",
             "source":"manual","title":"hello","impact":50,"confidence":0.7,
             "observedAt":"2026-05-04T05:00:00Z"}'
      ```
- [ ] `curl https://<radar>/api/ingest/recent?limit=5` shows the test row.
- [ ] Open the dashboard — the new signal must be visible (count and timeline shift).

## 2. Google Sheet

Create a new spreadsheet `RSG · Hiring Signals Sources`.

- [ ] Tab **Sources** — paste header from `docs/n8n/sources-template.csv`.
- [ ] Tab **Sources** — append rows from `docs/n8n/sources-sample.csv` (8 real DACH feeds).
- [ ] Tab **IngestLog** — paste header from `docs/n8n/ingestlog-template.csv`.
- [ ] Share the spreadsheet with the service account / user that the n8n
      Google Sheets credential is bound to.
- [ ] Copy the spreadsheet **id** (the long string in the URL).

## 3. n8n — env vars

In n8n → settings → environment variables:

- [ ] `HIRING_RADAR_INGEST_URL` = `https://<radar>/api/ingest`
- [ ] `HIRING_RADAR_INGEST_TOKEN` = same string as the radar's `INGEST_TOKEN`
- [ ] `RSG_SOURCES_SHEET_ID` = the spreadsheet id from step 2
- [ ] `TELEGRAM_CHAT_ID` = your group / private chat id

## 4. n8n — import workflow

- [ ] Workflows → Import from file → `docs/n8n/rsg-hiring-signals-live-ingest-v1.json`.
- [ ] Verify the new workflow appears as **draft** (not active). Do **not** activate yet.
- [ ] In `Google Sheets · Read Sources` and `Google Sheets · Append IngestLog` →
      replace `REPLACE_GS_CREDENTIAL_ID` with your real Google Sheets credential.
- [ ] In `Telegram · Daily Summary` → replace `REPLACE_TELEGRAM_CREDENTIAL_ID`
      with your real Telegram bot credential.
- [ ] Save.

## 5. n8n — manual dry-run

Run once with the **Execute workflow** button, **before** activating.

- [ ] Run completes without `error` status on the workflow level
      (individual source 404s are tolerated — that is by design).
- [ ] `IngestLog` tab fills with one row per article processed.
- [ ] Telegram receives exactly one summary message (not per article).
- [ ] Radar `/api/ingest/recent?limit=50` lists newly-ingested rows.
- [ ] Dashboard panels (sectors, regions, clusters, companies) reflect the new signals.

## 6. Backup before activation

- [ ] Export the workflow JSON from n8n right after import (Workflow → Download).
      Store it in your secrets vault / private gist. This is the canonical
      backup if the workflow is ever damaged.

## 7. Activation

- [ ] Toggle the workflow active.
- [ ] Wait for the next 06:00 CET tick (or trigger manually once more).
- [ ] Confirm the daily Telegram summary fires.
- [ ] Confirm the dashboard's `New · 24h` KPI is non-zero the next morning.

## 8. Rollback plan

If anything misbehaves:

1. **Toggle the workflow inactive** in n8n. Ingest stops immediately.
2. **Clear the radar's recent ring** — call `clearIngest()` via a temporary
   admin route, or simply restart the lambda (memory mode) / `DEL rsg:ingest:records:v1` (KV mode).
3. The dashboard returns to "adapter-only" state (8 mock companies). No data is leaked, no other workflow is affected.

## 9. What this checklist does NOT do

- ✗ It does not configure CRM / HubSpot / outreach / email automation. Out of scope by design.
- ✗ It does not redesign or alter the dashboard UI.
- ✗ It does not change any existing API response shape.
- ✗ It does not modify the scoring weights in `lib/scoring.ts`.
