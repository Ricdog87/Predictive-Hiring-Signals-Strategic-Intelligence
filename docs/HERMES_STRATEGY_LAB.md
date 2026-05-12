# Hermes Strategy Lab

Multi-Agent-Strategie-Lab für DACH-Recruiter. Liefert in einem einzigen
Engine-Lauf einen konsolidierten Vorstands-Brief mit Hiring-Predictions,
priorisierten Vertriebs-Actions, Risiken und Next Steps.

## Architektur

```
UI: /strategy-lab
  → POST /api/forecast/strategy-lab
    → lib/strategyLab.ts :: runHermesStrategyLab()
      → OpenRouter (Sonnet 4.6) – Single-Mega-Call
        ← strict JSON
      ← parse + validate + whitelabel-scrub
    ← { ok, data, quota }
```

Kein echtes Multi-Agent-Orchestration-Framework — der System-Prompt
weist das Modell an, intern sieben Rollen (Orchestrator, CEO, CFO,
CHRO, CTO, Macro Analyst, Sales Director) zu simulieren und in vier
Runden (Lagebild / Widersprüche / Konsens / Actions) zu konvergieren.
Nur das konsolidierte JSON kommt zurück.

## Endpoint

`POST /api/forecast/strategy-lab`

Headers (wenn `EXTERNAL_API_KEYS` gesetzt):

```
Authorization: Bearer <api-key>
Content-Type: application/json
```

Body:

```json
{
  "sector": "Automotive Tier-1",
  "region": "Baden-Württemberg",
  "companySizeRange": "1.000-5.000 MA",
  "horizonMonths": 9,
  "targetCount": 10,
  "notes": "Fokus auf Bestandskunden"
}
```

Erfolg (200):

```json
{
  "ok": true,
  "data": {
    "inputSnapshot": { ... },
    "assumptions": [ ... ],
    "executiveSummary": [ ... ],
    "marktLagebild": { "branchenTrends": [...], "regionaleHotspots": [...], "konsensKernaussagen": [...] },
    "predictions": [ ... ],
    "vertriebsActions": [ ... ],
    "openRisks": [ ... ],
    "nextSteps": [ ... ],
    "meta": { "runId": "...", "generatedAt": "...", "durationMs": 65000, "modelInternal": "[redacted]" }
  },
  "quota": { "remaining": 9, "limit": 10, "resetSec": 3600 }
}
```

Failure-Modi:

| HTTP | reason          | UI-Behandlung                                          |
| ---- | --------------- | ------------------------------------------------------ |
| 400  | validation      | Form-Validierung clientseitig wiederholen              |
| 400  | bad_request     | JSON-Parsing-Fehler                                    |
| 401  | missing/invalid | Auth-Header fehlt oder ist unbekannt                   |
| 403  | tier_required   | API-Key nicht in `STRATEGY_LAB_TIER_ALLOWLIST`         |
| 429  | quota_exceeded  | `Retry-After` + `X-RateLimit-*`-Header lesen           |
| 502  | upstream/parse  | Engine hat unerwartete Antwort geliefert — retry       |
| 503  | unconfigured    | API-Key nicht gesetzt — Feature unsichtbar             |
| 504  | timeout         | `HERMES_STRATEGY_LAB_TIMEOUT_MS` überschritten         |

## ENV-Konfiguration

| Variable                          | Default                          | Zweck                                       |
| --------------------------------- | -------------------------------- | ------------------------------------------- |
| `HERMES_STRATEGY_LAB_API_KEY`     | —                                | OpenRouter-Key (dedizierter Sub-Key)        |
| `HERMES_STRATEGY_LAB_MODEL`       | `anthropic/claude-sonnet-4.6`    | OpenRouter-Slug                             |
| `HERMES_STRATEGY_LAB_TIMEOUT_MS`  | `120000`                         | Hard-Timeout in ms                          |
| `HERMES_STRATEGY_LAB_HTTP_REF`    | —                                | OpenRouter HTTP-Referer-Header              |
| `HERMES_STRATEGY_LAB_APP_TITLE`   | —                                | OpenRouter X-Title-Header                   |
| `HERMES_STRATEGY_LAB_BASE_URL`    | `https://openrouter.ai/api/v1`   | Override für Mocks                          |
| `STRATEGY_LAB_QUOTA`              | `10`                             | Stündliches Limit pro Key                   |
| `STRATEGY_LAB_TIER_ALLOWLIST`     | —                                | Komma-Liste freigeschalteter Keys; leer = alle |

Wenn `HERMES_STRATEGY_LAB_API_KEY` leer ist, fällt der Client zurück
auf `HERMES_FORECAST_API_KEY` → `HERMES_API_KEY` →
`OPENROUTER_API_KEY`. Damit kannst du das Lab auch ohne dedizierten
Sub-Key probieren und später isolieren.

## Kosten / Latenz

- Modell: Sonnet 4.6 via OpenRouter (≈ Input 1.5×, Output 15× über
  Haiku 4.5)
- Typische Tokens pro Run: ~2.500 Input / ~3.500 Output
- Typische Latenz: 45-90 s end-to-end
- Worst-Case-Cost: ~0,12 USD pro Run. Bei `STRATEGY_LAB_QUOTA=10` und
  8 h Bürozeit ≈ 25 USD/Tag/Key Hard-Cap.
- **Pflicht:** OpenRouter-Sub-Key mit Monthly-Spend-Cap einrichten.
  Quota schützt nur Per-Key-Instanz; Spend-Cap ist die zweite Linie.

## Whitelabel-Garantie

`scrubStrategyLabResult()` filtert vor dem Response-Roundtrip alle
Vendor-Tokens (OpenAI, Anthropic, Claude, GPT, OpenRouter, MiroFish,
OASIS, Zep, Qwen, Sonnet, Haiku, Opus). `meta.modelInternal` wird auf
`[redacted]` gesetzt. Das ist eine Defense-in-Depth-Schicht — der
System-Prompt verbietet diese Tokens bereits, aber das Modell kann
sie versehentlich produzieren.

## Smoke-Test

```bash
curl -X POST https://<host>/api/forecast/strategy-lab \
  -H "Authorization: Bearer <api-key>" \
  -H "content-type: application/json" \
  -d '{
    "sector": "Maschinenbau",
    "region": "Baden-Württemberg",
    "companySizeRange": "250-1000 MA",
    "horizonMonths": 6,
    "targetCount": 8
  }' | jq
```

Erwartung: 200 mit vollem `data`-Objekt, oder 503 wenn keine Engine
konfiguriert ist, oder 429 wenn Quota überschritten.

## Roadmap

1. Persistenz: `strategy_lab_runs`-Tabelle in Supabase (optional,
   siehe `supabase/migrations/0XXX_strategy_lab_runs.sql`).
2. Echtes Multi-Agent-Orchestration mit pro-Rolle separaten Calls
   (deutlich teurer, bessere Diversität).
3. Web-Search-Tool für aktuellen Branchen-Heatmap-Kontext.
4. Persistierte Runs als shareable Briefs unter `/strategy-lab/<runId>`.
