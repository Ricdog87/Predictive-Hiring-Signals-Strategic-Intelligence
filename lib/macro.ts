/**
 * Macro indicators · v1.
 *
 * Free, public, no-auth data sources only. Each fetch is wrapped in a
 * graceful fallback — if the upstream is down, we surface a stale
 * snapshot rather than blanking the dashboard. Vercel's `next.revalidate`
 * caches the response so we don't hammer the upstream and so the page
 * is fast at the edge.
 *
 * Sources:
 *   - DE unemployment rate (monthly, seasonally adjusted): Eurostat
 *     `une_rt_m` indicator, JSON-stat 2.0.
 */

const EUROSTAT_DE_UNEMPLOYMENT =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m' +
  '?geo=DE&sex=T&age=TOTAL&unit=PC_ACT&s_adj=SA&lang=EN';

const REVALIDATE_SECONDS = Number(process.env.MACRO_REVALIDATE_SECONDS ?? 21_600); // 6h
const TIMEOUT_MS = Number(process.env.MACRO_TIMEOUT_MS ?? 8_000);

export interface DEUnemploymentSnapshot {
  rate: number; // percent, e.g. 6.0
  period: string; // ISO-ish month like "2025-11" (mapped from "2025M11")
  source: 'eurostat';
  indicator: string;
  fetchedAt: string;
}

export interface MacroError {
  ok: false;
  reason: 'timeout' | 'http_error' | 'parse_error' | 'network';
  detail?: string;
}

export type MacroResult<T> = { ok: true; data: T } | MacroError;

interface JsonStatLike {
  value?: Record<string, number> | number[];
  dimension?: {
    time?: {
      category?: {
        index?: Record<string, number>;
      };
    };
  };
}

/**
 * Eurostat returns JSON-stat 2.0. The relevant slice for our query is:
 *   {
 *     "value": { "0": 3.2, "1": 3.3, ... },        // or array
 *     "dimension": {
 *       "time": { "category": { "index": { "2025M01": 0, "2025M02": 1, ... } } }
 *     }
 *   }
 * We pick the entry with the highest index (= newest month) that has
 * a finite numeric value.
 */
function parseEurostat(payload: unknown): DEUnemploymentSnapshot | null {
  const j = payload as JsonStatLike;
  const idx = j?.dimension?.time?.category?.index;
  const values = j?.value;
  if (!idx || !values) return null;

  const entries = Object.entries(idx).sort(
    (a, b) => (b[1] as number) - (a[1] as number)
  );

  for (const [key, position] of entries) {
    const v = Array.isArray(values)
      ? values[position]
      : values[String(position)];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return {
        rate: Math.round(v * 100) / 100,
        period: key.replace(/^(\d{4})M(\d{2})$/, '$1-$2'),
        source: 'eurostat',
        indicator: 'une_rt_m · DE · TOTAL · PC_ACT · SA',
        fetchedAt: new Date().toISOString(),
      };
    }
  }
  return null;
}

export async function fetchDEUnemployment(): Promise<MacroResult<DEUnemploymentSnapshot>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(EUROSTAT_DE_UNEMPLOYMENT, {
      signal: ctrl.signal,
      // edge cache for a long-ish window — monthly indicator
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, reason: 'http_error', detail: `${res.status}` };
    }
    const json = await res.json();
    const parsed = parseEurostat(json);
    if (!parsed) {
      return { ok: false, reason: 'parse_error', detail: 'no time entry with numeric value' };
    }
    return { ok: true, data: parsed };
  } catch (err) {
    const message = (err as Error).message ?? 'unknown';
    return {
      ok: false,
      reason: message.includes('aborted') ? 'timeout' : 'network',
      detail: message,
    };
  } finally {
    clearTimeout(timer);
  }
}
