# Deployment runbook · production

End-to-end checklist for taking the Hiring Radar from preview to production.
The system has three deployment surfaces — Vercel (radar app), Hostinger
(Hermes LLM service), and Supabase (persistence). Each is independent and
can be deployed in any order.

## 1. Supabase · persistence layer

Free tier is sufficient for v1 traffic.

1. **Create project** at https://supabase.com — pick the EU-Central-1 region (Frankfurt) so it sits next to Vercel's eu-central edge.
2. **Run the migration** — open SQL Editor → new query → paste the contents of `supabase/migrations/0001_init.sql` → run. Creates `ingest_signals`, `news_items`, `intel_snapshots` with indexes and RLS-enabled-but-policy-empty (service-role bypasses RLS).
3. **Copy keys** from Settings → API:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` (server-only, never exposed to clients) → `SUPABASE_SERVICE_ROLE_KEY`
4. **Verify** via `psql` or the SQL Editor:
   ```sql
   select count(*) from public.ingest_signals;   -- 0
   select count(*) from public.news_items;       -- 0
   select count(*) from public.intel_snapshots;  -- 0
   ```

When both env vars are set on Vercel, every accepted `/api/ingest` signal lands in `ingest_signals`. Reads merge Supabase rows with the warm-lambda memory cache so the dashboard stays fast.

## 2. Vercel · radar app

1. **Connect the repo** at https://vercel.com → Import GitHub → pick `Ricdog87/Predictive-Hiring-Signals-Strategic-Intelligence`.
2. **Set the root environment** (Settings → Environment Variables, scope all to **Production** + **Preview**):

   ```
   # Identity (UI)
   NEXT_PUBLIC_USER_NAME=Ricardo
   NEXT_PUBLIC_USER_ROLE=Recruiting SG · Internal

   # Live ingest
   INGEST_TOKEN=<generate-once: openssl rand -hex 32>

   # Persistence (Supabase)
   SUPABASE_URL=<from step 1>
   SUPABASE_SERVICE_ROLE_KEY=<from step 1>

   # LLM bridge (Hermes on Hostinger)
   HERMES_BASE_URL=https://<your-host>/hermes
   HERMES_API_KEY=<same string set on Hostinger>

   # Optional · Adzuna (free tier)
   ADZUNA_APP_ID=<from developer.adzuna.com>
   ADZUNA_APP_KEY=<from developer.adzuna.com>

   # Optional · SaaS API-key gate
   EXTERNAL_API_KEYS=demo:60
   ```

3. **Deploy** — push any change to the branch the project is wired to. Vercel auto-deploys.
4. **Smoke** the new deploy:
   ```bash
   curl https://<your-vercel-url>/api/health | jq
   curl https://<your-vercel-url>/api/macro/ecb-rate
   curl https://<your-vercel-url>/api/regions/de | jq '.quadrants[0]'
   curl -H 'Authorization: Bearer demo' \
        https://<your-vercel-url>/api/intel/snapshot?topN=3 | jq '.macro'
   ```

   Expected `/api/health` body: `ok: true`, `ingest_store.detail: "tier: supabase"`, `eurostat_unemployment.ok: true`, `ecb_main_rate.ok: true`.

## 3. Hostinger · Hermes (LLM bridge)

1. **SSH onto the box** that runs node. Standard Hostinger Node app or a VPS.
2. **Pull the repo + build the service**:
   ```bash
   git clone https://github.com/Ricdog87/Predictive-Hiring-Signals-Strategic-Intelligence.git /var/www/rsg-hermes
   cd /var/www/rsg-hermes/services/hermes
   npm ci
   npm run build
   ```
3. **Provision env** (read on the server side only — never commit):
   ```bash
   export OPENROUTER_API_KEY='<your-openrouter-key>'
   export HERMES_API_KEY="$(openssl rand -hex 32)"
   echo "HERMES_API_KEY for Vercel: $HERMES_API_KEY"     # one-time copy

   bash scripts/install-env.sh                           # writes mode 600 .env
   ```
4. **Run under PM2**:
   ```bash
   mkdir -p logs
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup systemd                                   # follow printed cmd
   ```
5. **Reverse-proxy** via nginx — see snippet in `services/hermes/README.md`.
6. **Set `HERMES_BASE_URL` + `HERMES_API_KEY` on Vercel** (step 2 above) → redeploy → `curl https://<radar>/api/hermes/health` should return `configured: true`.

## 4. n8n · ingestion + intelligence digest

1. **Import** `docs/n8n/rsg-hiring-signals-live-ingest-v2.json` as a draft.
2. **Set credentials** — Google Sheets OAuth, Telegram bot.
3. **Set workflow env** (in n8n's settings):
   ```
   HIRING_RADAR_BASE_URL=https://<your-vercel-url>
   HIRING_RADAR_INGEST_TOKEN=<same as INGEST_TOKEN on Vercel>
   HIRING_RADAR_INTEL_API_KEY=<one of EXTERNAL_API_KEYS values>
   RSG_SOURCES_SHEET_ID=<your spreadsheet id>
   TELEGRAM_CHAT_ID=<your chat id>
   ```
4. **Manual dry-run** before activating. `IngestLog` should fill in; Telegram should receive the daily digest.
5. **Activate** the workflow.

## 5. Health check matrix · what "online" means

| Endpoint                          | Expected on prod                         |
|-----------------------------------|-------------------------------------------|
| `GET /api/health`                 | `ok: true` with all three required integrations green |
| `GET /api/macro/ecb-rate`         | `ok: true, rate: 2.x` |
| `GET /api/macro/de-unemployment`  | `ok: true, rate: 4.x` |
| `GET /api/regions/de`             | `quadrants: 4`, `bundeslaender: 16`, `unclassifiedCompanyCount: 0` |
| `GET /api/intel/snapshot`         | full payload with `auth.enforced: true` if SaaS keys configured |
| `GET /api/ingest/recent`          | `store: "supabase"` once persistence wired |
| `GET /api/news/feed`              | `feeds: 9 ok`, `classifiedCount > 0` |
| `GET /api/hermes/health`          | `configured: true, upstream.openrouter.configured: true` |

## 6. Rollback

The radar deploys are immutable on Vercel — every push gets its own URL.
To roll back: in Vercel Deployments, click the previous deploy → "Promote to Production".

The Hermes service has PM2's `pm2 logs rsg-hermes` for diagnostics and
`pm2 restart rsg-hermes` to bounce the process. The `.env` is mode 600
and gitignored — you can only break it on the box itself.

For Supabase, the migration is idempotent — re-running it is a no-op.
A rollback would mean dropping the three tables, which loses ingest history.

## 7. Cost ceiling (free / cheap tiers)

| Surface         | Tier                     | Monthly ceiling          |
|-----------------|--------------------------|--------------------------|
| Vercel          | Hobby                    | 100 GB-bandwidth, free   |
| Supabase        | Free                     | 500 MB DB, 2 GB transfer |
| Hostinger       | small VPS                | ~5–10 €                  |
| OpenRouter      | pay-as-you-go            | budget-capped per Hermes tier (RPM/RPD) |
| Eurostat / ECB / OECD | free, no auth      | 0 €                      |
| Adzuna          | dev tier                 | free, 25 calls / min     |

Hard cap on LLM cost is set in `services/hermes/.env` via
`HERMES_RPD_FAST/DEEP/LIVE` — when tripped, every request returns a
deterministic fallback rather than hitting OpenRouter.
