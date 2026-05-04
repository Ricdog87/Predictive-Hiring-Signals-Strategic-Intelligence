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

/**
 * NUTS-1 regional unemployment rate, annual (Eurostat indicator
 * `lfst_r_lfu3rt`). One geo filter per NUTS code (DE1..DEG). The
 * indicator is annual, so freshness lags ~12 months — that is fine
 * for context overlay purposes. Use a single multi-geo call to get
 * all 16 in one round-trip.
 */
const EUROSTAT_DE_REGIONAL =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/lfst_r_lfu3rt' +
  '?geo=DE1&geo=DE2&geo=DE3&geo=DE4&geo=DE5&geo=DE6&geo=DE7&geo=DE8&geo=DE9&geo=DEA&geo=DEB&geo=DEC&geo=DED&geo=DEE&geo=DEF&geo=DEG' +
  '&sex=T&age=Y15-74&unit=PC&lang=EN';

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

/**
 * Per-NUTS regional snapshot — one entry per Bundesland NUTS code.
 * `period` is a year string ("2024") for the annual indicator.
 */
export interface RegionalUnemploymentSnapshot {
  /** Map NUTS-1 code → { rate, period }. */
  byNuts: Record<string, { rate: number; period: string }>;
  source: 'eurostat';
  indicator: string;
  fetchedAt: string;
}

interface JsonStatRegional {
  value?: Record<string, number> | number[];
  dimension?: {
    geo?: { category?: { index?: Record<string, number> } };
    time?: { category?: { index?: Record<string, number> } };
  };
  size?: number[];
  id?: string[];
}

/**
 * JSON-stat 2.0 multi-dimensional decoder. Eurostat returns the
 * `value` map keyed by a flattened ordinal index across all
 * dimensions; we walk every (geo, time) pair, find the latest year
 * with a numeric value per geo, and emit a clean per-NUTS map.
 */
function parseEurostatRegional(payload: unknown): RegionalUnemploymentSnapshot | null {
  const j = payload as JsonStatRegional;
  const geoIdx = j?.dimension?.geo?.category?.index;
  const timeIdx = j?.dimension?.time?.category?.index;
  const values = j?.value;
  const size = j?.size;
  const id = j?.id;
  if (!geoIdx || !timeIdx || !values || !size || !id) return null;

  // Build dim → index lookup so we can compute the flat position.
  const dimIndex = new Map<string, number>();
  id.forEach((d, i) => dimIndex.set(d, i));
  const geoDimPos = dimIndex.get('geo');
  const timeDimPos = dimIndex.get('time');
  if (geoDimPos === undefined || timeDimPos === undefined) return null;

  // Multipliers per dimension — JSON-stat lays out values row-major
  // by `id` order, with `size[i]` cardinality per dimension.
  const mult: number[] = new Array(size.length).fill(1);
  for (let i = size.length - 2; i >= 0; i--) {
    mult[i] = mult[i + 1] * size[i + 1];
  }

  const getValue = (geoPos: number, timePos: number): number | null => {
    const offset = geoPos * mult[geoDimPos] + timePos * mult[timeDimPos];
    const v = Array.isArray(values)
      ? values[offset]
      : values[String(offset)];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  const timeEntries = Object.entries(timeIdx).sort(
    (a, b) => (b[1] as number) - (a[1] as number)
  );

  const byNuts: Record<string, { rate: number; period: string }> = {};
  for (const [nuts, geoPos] of Object.entries(geoIdx)) {
    for (const [period, timePos] of timeEntries) {
      const v = getValue(geoPos as number, timePos as number);
      if (v !== null) {
        byNuts[nuts] = {
          rate: Math.round(v * 100) / 100,
          period,
        };
        break;
      }
    }
  }

  return {
    byNuts,
    source: 'eurostat',
    indicator: 'lfst_r_lfu3rt · NUTS-1 · Y15-74 · PC',
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchDERegionalUnemployment(): Promise<
  MacroResult<RegionalUnemploymentSnapshot>
> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(EUROSTAT_DE_REGIONAL, {
      signal: ctrl.signal,
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, reason: 'http_error', detail: `${res.status}` };
    }
    const json = await res.json();
    const parsed = parseEurostatRegional(json);
    if (!parsed) {
      return { ok: false, reason: 'parse_error', detail: 'empty regional snapshot' };
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
