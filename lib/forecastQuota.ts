/**
 * forecastQuota.ts
 *
 * In-Memory Sliding-Window Quota für Scenario-Forecast-Runs.
 *
 * Limit pro API-Key in einer rollenden Stunde. Default 50/h, override via
 * FORECAST_SCENARIO_QUOTA env.
 *
 * Achtung: in einem Multi-Region-Vercel-Deployment ist das pro Instanz.
 * Für eine harte globale Grenze bräuchte man Redis/Upstash; das ist
 * bewusst nicht jetzt — siehe docs/MIROFISH_INTEGRATION.md "Roadmap".
 * Realistischerweise reicht das pro-Instanz-Limit als Kosten-Cap, weil
 * Vercel Hobby keine 100 parallelen Instanzen hochfährt.
 */

const WINDOW_MS = 60 * 60 * 1000;

function defaultLimit(): number {
  const raw = Number(process.env.FORECAST_SCENARIO_QUOTA ?? '50');
  return Number.isFinite(raw) && raw > 0 ? raw : 50;
}

interface Entry {
  // timestamps (ms epoch) of recent successful consumptions
  hits: number[];
}

const store = new Map<string, Entry>();

export interface QuotaCheck {
  ok: boolean;
  remaining: number;
  limit: number;
  resetSec: number; // seconds until oldest hit expires
}

/**
 * Try to consume one quota slot for `key`. Returns ok=true if allowed
 * and decremented; ok=false if over limit.
 */
export function consumeForecastQuota(key: string): QuotaCheck {
  const limit = defaultLimit();
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const e = store.get(key) ?? { hits: [] };
  e.hits = e.hits.filter((t) => t > cutoff);

  if (e.hits.length >= limit) {
    const oldest = e.hits[0] ?? now;
    const resetSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    store.set(key, e);
    return { ok: false, remaining: 0, limit, resetSec };
  }

  e.hits.push(now);
  store.set(key, e);
  return {
    ok: true,
    remaining: limit - e.hits.length,
    limit,
    resetSec: Math.ceil(WINDOW_MS / 1000),
  };
}

/**
 * Peek the current quota state without consuming. Useful for /health style
 * routes or admin endpoints.
 */
export function peekForecastQuota(key: string): QuotaCheck {
  const limit = defaultLimit();
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const hits = (store.get(key)?.hits ?? []).filter((t) => t > cutoff);
  const remaining = Math.max(0, limit - hits.length);
  const oldest = hits[0];
  const resetSec = oldest ? Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)) : Math.ceil(WINDOW_MS / 1000);
  return { ok: remaining > 0, remaining, limit, resetSec };
}

/** Test-only — clear the in-memory store. */
export function _resetForecastQuotaForTest(): void {
  store.clear();
}
