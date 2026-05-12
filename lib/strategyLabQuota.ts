/**
 * strategyLabQuota.ts
 *
 * In-Memory Sliding-Window Quota für Strategy-Lab-Runs. Identische
 * Mechanik wie lib/forecastQuota.ts, aber eigener Bucket — der
 * Strategy-Lab-Call ist 20-50× teurer pro Run als ein Scenario-Forecast,
 * deshalb separater Default (10/h) und eigener Env-Override.
 *
 * Achtung: pro Instanz. In einem Multi-Region-Vercel-Deployment ist
 * das nicht global hart. Reicht als Kosten-Cap, weil OpenRouter pro
 * Sub-Key bereits einen Monthly-Spend-Cap erzwingt.
 */

const WINDOW_MS = 60 * 60 * 1000;

function defaultLimit(): number {
  const raw = Number(process.env.STRATEGY_LAB_QUOTA ?? '10');
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
}

interface Entry {
  hits: number[];
}

const store = new Map<string, Entry>();

export interface QuotaCheck {
  ok: boolean;
  remaining: number;
  limit: number;
  resetSec: number;
}

export function consumeStrategyLabQuota(key: string): QuotaCheck {
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

export function peekStrategyLabQuota(key: string): QuotaCheck {
  const limit = defaultLimit();
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const hits = (store.get(key)?.hits ?? []).filter((t) => t > cutoff);
  const remaining = Math.max(0, limit - hits.length);
  const oldest = hits[0];
  const resetSec = oldest
    ? Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))
    : Math.ceil(WINDOW_MS / 1000);
  return { ok: remaining > 0, remaining, limit, resetSec };
}

export function _resetStrategyLabQuotaForTest(): void {
  store.clear();
}
