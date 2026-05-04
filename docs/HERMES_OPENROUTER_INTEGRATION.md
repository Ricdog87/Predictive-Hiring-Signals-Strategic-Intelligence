# Hermes + OpenRouter Integration

End-to-end LLM analysis layer for the Hiring Radar system.

```
n8n           Vercel (Hiring Radar)            Hostinger (Hermes)         OpenRouter
 │  POST /api/ingest        │                          │                       │
 ├──────────────────────────▶  store + merge ───────────│                       │
 │                          │                          │                       │
 │  POST /api/ingest                                  GET /health              │
 │  │ optional follow-up                                                       │
 │  ▼                                                                          │
 │  POST /api/hermes/analyze-signal ─▶  POST /analyze-signal ─▶  fast model ──▶│
 │                                                                             │
 │  POST /api/hermes/opportunity-brief ─▶  POST /generate-opportunity-brief ──▶│
 │                                            │ deep model                    │
 │                                            ▼                               │
 │                                          JSON brief                        │
```

## Components shipped

| Component | Path | Role |
|-----------|------|------|
| **Hermes service** | `services/hermes/` | Standalone Express service. Owns the OpenRouter API key. Two-tier model strategy. Bearer-auth optional but recommended. PM2-ready. |
| **OpenRouter wrapper** | `services/hermes/src/openrouter.ts` | Timeout, model tiering, JSON-mode, structured fallback. |
| **Cost guardrail** | `services/hermes/src/lib/budget.ts` | Per-tier RPM + RPD counters; blown caps return graceful fallback, not crashes. |
| **Bearer auth** | `services/hermes/src/lib/auth.ts` | Optional. `/health` is always open for monitors. |
| **Radar client** | `lib/hermesClient.ts` | Fetch wrapper used by the radar's `/api/hermes/*` proxies. Hard timeout, structured errors, no throws. |
| **Radar proxies** | `app/api/hermes/{health,analyze-signal,opportunity-brief}/route.ts` | Public radar surface. Always returns JSON, never blocks the dashboard. |
| **MiroFish stub** | `lib/mirofishClient.ts` + `app/api/mirofish/health/route.ts` | Placeholder. Returns `{stub:true}` when unconfigured. **Not** on the production-critical path. |

## Where each secret lives

| Secret | Lives on | Used by | Notes |
|--------|----------|---------|-------|
| `OPENROUTER_API_KEY` | Hostinger / Hermes only | Hermes → OpenRouter | **Never** on Vercel. The radar talks to Hermes, not OpenRouter. |
| `HERMES_API_KEY` | Hostinger (server-side) **and** Vercel (radar) | Hermes ↔ Hiring Radar | Same value on both ends. |
| `INGEST_TOKEN` | Vercel + n8n | n8n → /api/ingest | Already in place from PR #9. |

`OPENROUTER_API_KEY` deliberately does **not** ship to Vercel — Hermes is
the only process that gets to call OpenRouter. This keeps cost
attribution and rate limits in one place.

## Model tiering

| Tier | Default model | Used for | Why |
|------|---------------|----------|-----|
| **fast** | `openai/gpt-4o-mini` | Signal classification, company summary | Cheap (~$0.15 / M in), JSON-mode supported, fast. |
| **deep** | `anthropic/claude-3.5-haiku` | Opportunity brief only | Better narrative, still cheap (~$0.80 / M in). |

Override via `OPENROUTER_MODEL_FAST` / `OPENROUTER_MODEL_DEEP`. Anything
on https://openrouter.ai/models that supports chat completions works.

### Cost guardrails (per-tier)

In-process counters cap requests:

| Tier | RPM (default) | RPD (default) | Env override |
|------|--------------|---------------|--------------|
| fast | 30 | 3 000 | `HERMES_RPM_FAST` / `HERMES_RPD_FAST` |
| deep | 6 | 200 | `HERMES_RPM_DEEP` / `HERMES_RPD_DEEP` |

Tripped caps return `200` with `ok:false`, `fellBack:true` and a
deterministic fallback. The pipeline keeps moving; the budget is
respected.

## API contracts (radar-side)

### `GET /api/hermes/health`
Always returns `200`. Body shape:
```jsonc
// configured + healthy
{ "ok": true, "configured": true, "upstream": { "service":"rsg-hermes", "openrouter":{"configured":true,...}, ... } }

// configured but Hermes unreachable
{ "ok": false, "configured": true, "reason": "timeout", "detail": "..." }

// not configured (HERMES_BASE_URL unset)
{ "ok": false, "configured": false, "reason": "unconfigured", ... }
```

### `POST /api/hermes/analyze-signal`
Request body:
```jsonc
{
  "companyName": "Apex Dynamics",
  "signalType": "funding_grant",
  "title":      "Apex Dynamics receives 10M EUR",
  "description":"...",
  "source":     "newsroom_rss",
  "observedAt": "2026-05-04T05:00:00Z"
}
```
Response (success):
```jsonc
{
  "ok": true,
  "analysis": {
    "summary": "...",
    "intent":  "funding",
    "rolesLikely": ["engineering","gtm"],
    "urgency": "high",
    "riskFlag": false,
    "confidence": 0.86
  },
  "model": "openai/gpt-4o-mini",
  "usage": { "prompt_tokens":120, "completion_tokens":80, "total_tokens":200 },
  "generatedAt": "..."
}
```
Response (LLM offline / budget tripped):
```jsonc
{ "ok": false, "fellBack": true, "reason": "timeout", "detail": "..." }
```

### `POST /api/hermes/opportunity-brief`
Two ways to call it:

**Convenient** — pass just the radar's `companyId`. The radar enriches the
payload from `getAggregates()` automatically:
```jsonc
{ "companyId": "comp_001", "opportunityScore": 88, "topSignals":["funding_grant","job_spike"] }
```

**Explicit** — pass everything yourself:
```jsonc
{
  "companyName": "Apex Dynamics",
  "industry":    "Industrial AI",
  "region":      "DACH · North",
  "opportunityScore": 88,
  "hiringScore": 76,
  "topSignals": ["funding_grant","job_spike"],
  "predictedRoles": ["engineering","gtm","operations"],
  "bestContactPersona": "VP Engineering / Head of R&D",
  "signals": [ { "signalType":"funding_grant","title":"...", ... } ]
}
```

Response (success):
```jsonc
{
  "ok": true,
  "brief": {
    "headline": "...",
    "whyNow":   "...",
    "evidence": ["...","..."],
    "rolesAndPersonas": ["engineering · VP Engineering", ...],
    "talkingPoints": ["...","..."],
    "risks": [],
    "recommendedTiming": "this_week",
    "confidence": 0.82
  },
  "model": "anthropic/claude-3.5-haiku",
  "generatedAt": "..."
}
```

### `GET /api/mirofish/health`
Always returns `200`. Returns `{stub:true,configured:false}` until
`MIROFISH_BASE_URL` is wired up. **Nothing** in the dashboard depends
on this endpoint.

## n8n integration · two patterns

### Pattern A — recommended · radar-side fan-out
n8n stays focused on collection. After `POST /api/ingest`, n8n
optionally fires `POST /api/hermes/analyze-signal` against the radar
for each newly-accepted signal. The radar talks to Hermes; n8n never
sees the OpenRouter key, the Hermes key, or the LLM model id.

```
[n8n cron]
   │
   ▼
[POST /api/ingest]  ─┐
                     │  on success, for each accepted signal:
                     ▼
[POST /api/hermes/analyze-signal]  ← radar calls Hermes
                     │
                     ▼
[Sheets · IngestLog row gets `intent`/`urgency` columns]
```

### Pattern B — n8n calls Hermes directly
Skip the radar in the analysis hop. n8n holds `HERMES_API_KEY` in its
env and points to `https://<hermes-host>/analyze-signal` directly.
Saves one network hop, costs you a key surface in n8n. Use only if
your radar/Hermes deployment is co-located and latency matters.

## Deployment · Hostinger (Hermes)

Step-by-step:

1. **Provision** a Node 20+ runtime (Hostinger's "Node app" tile or your VPS).
2. **Pull the repo** onto the host:
   ```bash
   git clone <repo> /var/www/rsg-hermes
   cd /var/www/rsg-hermes/services/hermes
   ```
3. **Install + build**:
   ```bash
   npm ci
   npm run build
   ```
4. **Configure env**:
   ```bash
   cp .env.example .env
   # then fill OPENROUTER_API_KEY, HERMES_API_KEY at minimum
   ```
5. **Start under PM2**:
   ```bash
   mkdir -p logs
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup systemd
   pm2 logs rsg-hermes --lines 50
   ```
6. **Reverse proxy** (nginx). Forward `/hermes/*` to `127.0.0.1:4001`,
   strip the prefix. Keep the `Authorization` header. See
   `services/hermes/README.md` for the snippet.
7. **TLS** — terminate via Let's Encrypt at nginx.
8. **Smoke check** from your laptop:
   ```bash
   curl https://<host>/hermes/health
   ```
9. **Wire the radar** — set on Vercel:
   - `HERMES_BASE_URL=https://<host>/hermes`
   - `HERMES_API_KEY=<same string used on the server>`
10. **Verify radar → Hermes**:
    ```bash
    curl https://<radar>/api/hermes/health | jq
    ```
    Expect `ok:true`, `configured:true`, `upstream.openrouter.configured:true`.

## Operational notes

- **Hermes down → radar still green.** Every `/api/hermes/*` route returns
  a structured `ok:false` payload, never a 5xx. The dashboard pages
  don't render any panel that depends on Hermes today; if/when they do,
  use the `ok` flag, never assume the data exists.
- **OpenRouter 5xx → graceful fallback.** Each Hermes handler ships a
  deterministic fallback object (same JSON shape) so callers parsing
  `analysis.summary` etc. don't blow up on transient LLM hiccups.
- **Budget tripped → silent throttle.** Hermes returns the same
  fallback shape with `ok:false` and `error:"budget guardrail tripped"`.
  Monitor with `/health → budget[]` and tighten the env if needed.
- **Restart policy.** PM2 `autorestart: true`, `max_restarts: 10`,
  `min_uptime: 10s`, `restart_delay: 4000`. Crash loops won't hammer
  OpenRouter — and, even if they do, the budget cap stops the bleeding.

## What this PR does NOT do

- ✗ No CRM / outreach / email / message generation.
- ✗ No OpenClaw integration (explicitly deferred).
- ✗ No UI changes — the dashboard layout, the welcome banner, the
  panels are untouched. Any dashboard surface that *uses* Hermes
  output will land in a separate, focused PR.
- ✗ No changes to existing API response shapes, scoring weights or the
  ingest payload.
