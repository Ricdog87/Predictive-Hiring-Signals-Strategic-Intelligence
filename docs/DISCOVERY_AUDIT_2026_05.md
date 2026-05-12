# Discovery-Layer-Audit · Mai 2026

Snapshot der Datenquellen-Lage vor PR `feat/discovery-mittelstand-expansion`.

## Symptome (Dashboard)

- JOBS-Tab: 11/17 Kategorien N/A
- COMPANIES-Tab: DAX-Übergewicht (Bayer, SAP, Lufthansa, Apple, TikTok, Adidas, Commerzbank, Carl Zeiss)
- INSOLVENZ-Tab: 4 Restructurings, 0 Mittelstands-Insolvenzen
- TODAY · Sektor-Heat: +0 in fast allen Sektoren
- Patent-Signals (Sidebar): IDLE
- Vercel-Logs: `[mockData] discovery ok=false: budget`

## Befunde

### Discovery-Layer

| Punkt | Wert |
|---|---|
| File | `lib/anthropicDiscovery.ts` |
| Aktivierungs-Gate | `ANTHROPIC_DISCOVERY_ENABLED=true` (Zeile 53, Default `false`) |
| Modell | `claude-haiku-4-5-20251001` (Zeile 58) |
| Token-Cap | `max_tokens=6_000` (Zeile 246) |
| Cache | 6 h (`CACHE_MS`, Zeile 27) |
| Timeout | 60 s |
| Missions | `INSOLVENZ_MISSION` (Zeilen 103-137) · `HIRING_MISSION` (Zeilen 139-225) |
| Mid-Cap-Hint vorhanden | Ja, seit August — Zeile 221: „Bevorzuge Mid-Cap & Mittelstand (50–10.000 MA), nicht nur DAX." Aber wirkungslos, solange der Layer im Default-Off ist. |

### Jobs

| Punkt | Wert |
|---|---|
| Live-Quelle | Adzuna (`lib/jobMarketSources.ts`) — 17 Kategorien, `ADZUNA_APP_ID + ADZUNA_APP_KEY` |
| Bundesagentur-Adapter | **Nicht vorhanden** (`grep arbeitsagentur` leer) |
| Cache | 30 min (`ADZUNA_REVALIDATE_SECONDS=1800`) |
| Timeout | 8 s |

Die N/A-Anzeige bei 11 Kategorien bedeutet, dass Adzuna für diese Slugs aktuell kein Volumen liefert (entweder Adzuna-API throttled oder Adzuna kennt den Slug für DE nicht). Bundesagentur deckt diese Lücken zuverlässig ab.

### Company-Seed

| Punkt | Wert |
|---|---|
| File | `src/companyMaster/master.ts` Zeilen 25-59 |
| Anzahl Records | 3 (Apex Dynamics, NorthGrid Energy, Helios Mobility) — alles Synthetik, alles mid-cap |
| DAX-Bias-Ursache | Nicht der Seed — sondern die RSS-News-Klassifizierung (`lib/newsClassifier.ts`), in der DAX-Konzerne Tier-1-Wires dominieren. Mittelstands-Hinweise gehen im Tier-1-Volumen unter. |

### Cron

| Punkt | Wert |
|---|---|
| `vercel.json` | **Existiert nicht** |
| `app/api/cron/*` | **Existiert nicht** |
| Auth-Pattern | Noch nicht definiert |

Discovery-Refresh läuft heute nur lazy bei `/api/intel/snapshot`-Calls.

### Patent-Signals

| Punkt | Wert |
|---|---|
| Signaltyp definiert | `lib/signalClassifier.ts:200-210` (Keyword-Match: „patent filing", „patentanmeldung", „patent erteilt", „schutzrecht", „gebrauchsmuster") |
| Scoring | `lib/scoring.ts` Gewicht 0.8, base impact 16, confidence 0.78 |
| Trust | `lib/sourceTrust.ts:69-72` 0.88 |
| Active-Fetch (DPMA / EPO OPS / WIPO) | **Nicht implementiert** |
| UI-Status | `lib/uiMockData.ts:22` zeigt `status: "idle"` — korrekt, da kein aktiver Fetch |

### Whitelabel

| Punkt | Wert |
|---|---|
| Utility | `stripVendor<T>()` in `lib/hermesClient.ts:401-421` |
| Domains gefiltert | perplexity.ai, openai.com, anthropic.com, openrouter.ai, sdmx.oecd.org, stats.oecd.org, data-api.ecb.europa.eu, developer.adzuna.com, api.adzuna.com |
| Felder gefiltert | `model`, `usage`, `engine` |

### Sektor-Heat

Wird live aus `CompanyAggregate`-Signalen aggregiert (`lib/marketView.ts:151`). „+0 in fast allen Sektoren" ist Direktfolge des Mock-Modus im Discovery-Layer (kaum echte Signale → kein Momentum). Eigener Fix unnötig — wird durch Reactivation in dieser PR automatisch grün.

## Required ENV vars (für Vercel zu setzen)

| Variable | Zweck | Pflicht für |
|---|---|---|
| `ANTHROPIC_DISCOVERY_ENABLED=true` | Schaltet den Discovery-Layer aus Mock raus | Discovery-Reactivation |
| `ANTHROPIC_API_KEY` | Bearer für die Anthropic-Messages-API mit `web_search`-Tool | Discovery-Reactivation |
| `ANTHROPIC_DISCOVERY_MODEL` (optional) | Default `claude-haiku-4-5-20251001` | Override |
| `ANTHROPIC_DISCOVERY_WINDOW_DAYS` (optional) | Default 90 | Override |
| `ANTHROPIC_DISCOVERY_MAX_EVENTS` (optional) | Default 30 | Cost-Cap |
| `ANTHROPIC_DISCOVERY_MAX_SEARCHES` (optional) | Default 5 | Cost-Cap |
| `CRON_SECRET` | Bearer für `/api/cron/discovery-refresh` | Cron-Schedule |
| `BA_JOBS_TIMEOUT_MS` (optional) | Default 15000 | Bundesagentur-Adapter |

## Kosten-Schätzung

| Pfad | Annahme | $/Tag |
|---|---|---|
| Discovery (4× 6 h, beide Missions) | 8 Calls × (≈3k input + ≈3k output) Tokens × Haiku 4.5 | ≈ 0,04 |
| Bundesagentur | Kostenlos (öffentlicher Demo-API-Key `jobboerse-jobsuche`) | 0 |
| Adzuna | Free Tier (1k Calls/Monat reichen) | 0 |

Effektiv landet die PR auf **3-5 € / Monat** Worst-Case, gut innerhalb des 3-10 €-Budgets.
