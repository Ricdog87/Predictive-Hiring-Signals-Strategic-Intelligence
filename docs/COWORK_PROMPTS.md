# Cowork prompts · ready to dispatch

Copy-pastable prompts for the deployment-capable Claude (or any agent
with shell + browser access) that takes the RSG Hiring Radar live.
Each prompt is self-contained — the receiving session does not have
the context of this repo's chat history.

The repo: `Ricdog87/Predictive-Hiring-Signals-Strategic-Intelligence`
The branch to ship: `claude/hermes-openrouter-v1`
The runbook to follow: `docs/DEPLOYMENT.md`

## 1. Primary · "take it live"

Single prompt that orchestrates Vercel + Supabase. Use this first.

```
You are a senior DevOps engineer dispatched to take the RSG Hiring
Radar from a feature branch to live production. Repo:
Ricdog87/Predictive-Hiring-Signals-Strategic-Intelligence. Branch:
claude/hermes-openrouter-v1. Follow docs/DEPLOYMENT.md verbatim — the
runbook is the source of truth. Hostinger and n8n are out of scope
for this dispatch.

Your job in this exact order:

A. Vercel — radar app
   1. Connect the GitHub repo and select branch `claude/hermes-openrouter-v1`
      as the production source.
   2. Production env vars (Settings → Environment Variables, scope to
      Production AND Preview):
        NEXT_PUBLIC_USER_NAME=Ricardo
        NEXT_PUBLIC_USER_ROLE=Recruiting SG · Internal
        INGEST_TOKEN=<run: openssl rand -hex 32>          # record value
        EXTERNAL_API_KEYS=demo:60                         # SaaS smoke key
      Leave SUPABASE_*, HERMES_*, ADZUNA_*, KV_* unset for now (the
      radar is designed to fall back gracefully when these are absent).
   3. Trigger a deployment. Wait for it to be ready.
   4. Smoke the production URL:
        curl https://<prod>/api/health | jq '.ok, .integrations[].name'
        curl https://<prod>/api/macro/ecb-rate
        curl -H 'Authorization: Bearer demo' https://<prod>/api/intel/snapshot?topN=3
        curl https://<prod>/api/forecast/companies?topN=3 | jq '.data[0]'
      Report each response status. Confirm `/api/health.ok === true` with
      ingest_store + eurostat + ecb green.

B. Supabase — persistence layer (free tier)
   1. Create a new project `rsg-hiring-radar` in the eu-central-1
      (Frankfurt) region.
   2. Run supabase/migrations/0001_init.sql in the SQL editor (or via
      `supabase db push` if CLI is wired up).
   3. From Settings → API copy:
        - Project URL  → goes to Vercel as SUPABASE_URL
        - service_role → goes to Vercel as SUPABASE_SERVICE_ROLE_KEY
      service_role key NEVER leaves the Vercel env panel.
   4. Redeploy on Vercel.
   5. Confirm /api/health now reports
        integrations.find(i => i.name === 'ingest_store').detail
          === 'tier: supabase'

Hard constraints:
  - Never commit a secret. Everything goes through Vercel + Supabase
    env panels.
  - Never push to main. The deployable branch is
    claude/hermes-openrouter-v1; only PR #12 may merge to main.
  - If a step fails, stop and report: which step, what error, what
    state. Don't silently bypass.

Final report should include:
  - Production Vercel URL.
  - Supabase project URL (no service_role key in the report).
  - The /api/health JSON with secrets sanitized.
  - The INGEST_TOKEN you generated (so n8n can be wired up next).
  - A copy-pasteable env summary for the next stage.
```

## 2. Hostinger · Hermes deployment

Run this AFTER prompt 1, only when you want LLM features (regional
insights, opportunity briefs, n8n's Hermes-enrichment hop) live.

```
You are a senior DevOps engineer dispatched to deploy the Hermes LLM
service onto a Hostinger Node app or VPS. Repo: Ricdog87/Predictive-
Hiring-Signals-Strategic-Intelligence. Branch: claude/hermes-openrouter-v1.
Follow docs/DEPLOYMENT.md Section 3 verbatim.

Inputs you will receive at dispatch time:
  - SSH connection to the Hostinger box.
  - OPENROUTER_API_KEY (rotated; treat as secret, never echo).
  - The Vercel production URL of the radar (so /api/hermes/health can
    be smoked end-to-end).

Your job:
  1. SSH onto the box, clone the repo to /var/www/rsg-hermes, checkout
     branch claude/hermes-openrouter-v1.
  2. cd services/hermes && npm ci && npm run build.
  3. Generate HERMES_API_KEY: openssl rand -hex 32. Record the value
     for the next step but never echo it to logs.
  4. Export OPENROUTER_API_KEY and HERMES_API_KEY in the shell, run
     bash scripts/install-env.sh. The script writes a mode-600 .env;
     verify it exists and is gitignored.
  5. mkdir -p logs. pm2 start ecosystem.config.js. pm2 save. pm2
     startup systemd (follow the printed sudo command).
  6. nginx config: forward /hermes/* to 127.0.0.1:4001 with the
     Authorization header preserved. Snippet is in
     services/hermes/README.md. Reload nginx.
  7. Smoke:
        curl https://<host>/hermes/health
      Expect: { ok: true, openrouter.configured: true,
                auth: 'enforced' }.
  8. On Vercel set HERMES_BASE_URL=https://<host>/hermes and
     HERMES_API_KEY=<the key from step 3>. Redeploy.
  9. End-to-end smoke:
        curl https://<radar>/api/hermes/health
      Expect: { ok: true, configured: true,
                upstream.openrouter.configured: true }.

Hard constraints:
  - Never commit, email, or paste OPENROUTER_API_KEY or HERMES_API_KEY
    in plaintext anywhere outside the box and the Vercel env panel.
  - After install-env.sh has run, unset OPENROUTER_API_KEY and
    HERMES_API_KEY from the shell environment and clear shell history
    (history -c).
  - The .env on the box must remain mode 600 and gitignored.

Report back:
  - PM2 process state (pm2 list).
  - The radar's /api/hermes/health response (sanitized).
  - The Vercel HERMES_API_KEY (so n8n can use it for the digest cron).
```

## 3. Adzuna · live job-market data

Tiny prompt — 5 minutes max.

```
You are dispatched to enable Adzuna integration on the live RSG
Hiring Radar. Steps:

  1. Sign up at https://developer.adzuna.com/ (free tier).
  2. Create an application; record APP_ID and APP_KEY.
  3. On Vercel, set:
        ADZUNA_APP_ID=<value>
        ADZUNA_APP_KEY=<value>
  4. Trigger a redeploy.
  5. Smoke:
        curl https://<radar>/api/jobmarket/pulse | jq '.totalPostings'
     Expect a positive integer; failure = report which.

Hard constraint: APP_KEY is a secret — Vercel env panel only, no
git, no email, no paste.
```

## 4. n8n · pipeline activation

Dispatch this once Vercel + Hermes are live.

```
You are dispatched to activate the RSG Hiring Signals live ingest +
intelligence digest pipeline on the existing n8n instance at
https://n8n.srv986889.hstgr.cloud. Repo branch
claude/hermes-openrouter-v1 contains the v2 workflow at
docs/n8n/rsg-hiring-signals-live-ingest-v2.json.

Inputs you will receive at dispatch time:
  - n8n login.
  - Vercel production URL of the radar.
  - INGEST_TOKEN (matches Vercel value).
  - One value from EXTERNAL_API_KEYS (used as INTEL_API_KEY).
  - Telegram bot token + target chat ID.
  - Google Sheets OAuth credential id (already in n8n).

Your job:
  1. Workflows → Import from file → upload
     docs/n8n/rsg-hiring-signals-live-ingest-v2.json. The workflow
     ships as a draft; do NOT activate yet.
  2. Replace the credential placeholders:
        REPLACE_GS_CREDENTIAL_ID
        REPLACE_TELEGRAM_CREDENTIAL_ID
     with the real ids in the imported workflow.
  3. Set the workflow env vars in n8n:
        HIRING_RADAR_BASE_URL=<vercel prod url>
        HIRING_RADAR_INGEST_TOKEN=<INGEST_TOKEN value>
        HIRING_RADAR_INTEL_API_KEY=<one EXTERNAL_API_KEYS value>
        RSG_SOURCES_SHEET_ID=<spreadsheet id from docs/n8n/sources-list.md>
        TELEGRAM_CHAT_ID=<chat id>
  4. Manual dry-run via "Execute workflow":
        - The Sources sheet must read 8 rows (sample), filter active.
        - Each loop iteration calls /api/ingest AND
          /api/hermes/analyze-signal in parallel.
        - IngestLog sheet receives one row per article with
          hermes_intent / hermes_urgency / hermes_risk_flag /
          hermes_summary populated.
        - Telegram receives ONE intelligence digest at the end of the
          digest cron (separate cron at 08:00 CET).
  5. Confirm the radar's /api/ingest/recent now returns the inserted
     signals. Confirm /api/intel/snapshot 'forecast.summary' shows
     them in the pipeline index.
  6. Activate the workflow.

Hard constraints:
  - Do not modify any other workflow on the n8n instance.
  - If a Hermes call fails, the workflow is designed to continueOnFail
    — verify that behaviour holds in the dry run before activating.
  - INGEST_TOKEN and INTEL_API_KEY are secrets; n8n env panel only.
```

## 5. Health-check · monitor wire

After everything is live, plug the health endpoint into UptimeRobot
or BetterStack:

```
Monitor: https://<radar>/api/health
Method: GET
Expect: HTTP 200 with body.ok === true
Polling: every 5 minutes
Alert thresholds:
  - body.ok === false for two consecutive checks → page
  - integrations.find(i => i.name === 'eurostat_unemployment').ok
    === false for 30 minutes → low-priority alert (Eurostat outage,
    not actionable on our side)
  - integrations.find(i => i.name === 'supabase').ok === false at
    any point → page (data is being lost into memory tier)
```

## Tips for the dispatcher

- Run prompt 1 first. Wait for the report. Verify before moving to 2.
- Prompts 2 + 3 + 4 are independent and can run in parallel once 1 is done.
- Always pass the INGEST_TOKEN, HERMES_API_KEY, INTEL_API_KEY values
  through a secure channel (1Password, password manager, n8n env panel).
  Never paste them in chat history.
- If any prompt asks you to commit a secret, refuse and report.
