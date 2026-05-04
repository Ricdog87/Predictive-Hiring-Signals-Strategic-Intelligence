# RSG Hermes

LLM-backed analysis service for the Hiring Radar pipeline.
Runs on Hostinger (or any Node 20+ host), exposes four endpoints,
and uses OpenRouter as the LLM provider with cost guardrails.

## Endpoints

| Method | Path | Auth | Tier  | Purpose |
|--------|------|------|-------|---------|
| GET    | `/health` | none | n/a | Liveness + config snapshot. |
| POST   | `/analyze-signal` | bearer | fast | Classify a single signal, return JSON `{summary, intent, rolesLikely, urgency, riskFlag, confidence}`. |
| POST   | `/analyze-company` | bearer | fast | Summarise a company against its recent signals. JSON `{thesis, topDrivers, watchOuts, rolesLikely, timing, confidence}`. |
| POST   | `/generate-opportunity-brief` | bearer | deep | Internal recruiting brief. JSON `{headline, whyNow, evidence, rolesAndPersonas, talkingPoints, risks, recommendedTiming, confidence}`. |

All POST endpoints accept `application/json`. All return `200` with
`ok: false` and a deterministic fallback when the LLM is unavailable
(timeout, 5xx, missing key, budget tripped) so the caller's pipeline
isn't blocked. Network errors return real HTTP error codes only on
truly invalid input (e.g. missing `companyName`).

## Run locally

```bash
cd services/hermes
cp .env.example .env       # fill in OPENROUTER_API_KEY + HERMES_API_KEY
npm install
npm run dev
curl http://localhost:4001/health | jq
```

## Deploy to Hostinger (Node app + PM2)

```bash
# on the server
cd /var/www/rsg-hermes
git pull
cd services/hermes
npm ci --omit=dev=false       # we need typescript at build time
npm run build
cp .env.example .env          # then edit with real keys
mkdir -p logs

# start under PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd           # follow the printed command
pm2 logs rsg-hermes --lines 50
```

Behind nginx, terminate TLS and forward `/hermes/*` to `127.0.0.1:4001`
without rewriting the path. Keep the `Authorization` header.

```nginx
location /hermes/ {
  proxy_pass http://127.0.0.1:4001/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_read_timeout 30s;
  proxy_send_timeout 30s;
}
```

## Cost guardrails

Per-tier counters (in-process) cap requests per minute and per day.
Defaults (overridable via env):

| Tier | RPM | RPD |
|------|-----|-----|
| fast | 30  | 3 000 |
| deep | 6   | 200 |

When a cap trips, the call returns `200` with `ok:false`,
`fellBack:true` and a deterministic fallback — the *budget* is enforced,
the *pipeline* is not stopped.

## Security

- `HERMES_API_KEY` enforces bearer-auth on every non-`/health` route.
- No secrets are committed; `.env` is gitignored. `.env.example` ships
  with empty values only.
- The OpenRouter API key never leaves the server — Hiring Radar talks
  to Hermes, never to OpenRouter directly.

## Observability

`/health` returns:

```jsonc
{
  "ok": true,
  "service": "rsg-hermes",
  "version": "0.1.0",
  "uptimeSec": 1234,
  "auth": "enforced",
  "openrouter": { "configured": true, "fastModel": "...", "deepModel": "...", "timeoutMs": 25000 },
  "budget": [
    { "tier":"fast", "perMinute":{"used":3,"limit":30,"resetInSec":42}, "perDay":{...} },
    { "tier":"deep", ... }
  ]
}
```

Wire that JSON into your existing uptime checker (UptimeRobot,
BetterStack, n8n cron). A `200` with `auth:"enforced"` and
`openrouter.configured:true` is the green-bar.
