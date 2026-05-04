/**
 * Macro sources · v2.
 *
 * Free, no-auth, public APIs that ground the dashboard's intelligence
 * layer in real-economy numbers:
 *
 *   - ECB Statistical Data Warehouse (HICP inflation, main refinancing
 *     rate). Format: SDMX 2.1 JSON.
 *   - Eurostat (job-vacancy rate, employment rate). Format: JSON-stat.
 *   - OECD MEI / Composite Leading Indicator. Format: SDMX-JSON v1.
 *
 * Every fetch is hard-timeout-bounded, runs through `next.revalidate`
 * for edge caching, and returns a structured fallback rather than
 * throwing. Never blocks the dashboard.
 */

const TIMEOUT_MS = Number(process.env.MACRO_TIMEOUT_MS ?? 8_000);
const REVALIDATE_SHORT = 3_600; // 1h — for daily-ish indicators
const REVALIDATE_LONG = 21_600; // 6h — for monthly/quarterly indicators

interface FetchOpts {
  url: string;
  revalidate?: number;
  accept?: string;
}

async function fetchJsonSafe<T>(opts: FetchOpts): Promise<
  | { ok: true; data: T }
  | { ok: false; reason: 'timeout' | 'http_error' | 'parse_error' | 'network'; detail?: string }
> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(opts.url, {
      signal: ctrl.signal,
      next: { revalidate: opts.revalidate ?? REVALIDATE_LONG },
      headers: { Accept: opts.accept ?? 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, reason: 'http_error', detail: `${res.status}` };
    }
    try {
      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch (err) {
      return { ok: false, reason: 'parse_error', detail: (err as Error).message };
    }
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

// -----------------------------------------------------------------------------
// ECB · Statistical Data Warehouse
// -----------------------------------------------------------------------------
//
// SDMX 2.1 JSON. Latest observation across all dimensions is what we
// want. The `dataSets[0].series` map is keyed by a colon-joined
// dimension index ("0:0:0:0:..." per dimension); each series carries
// an `observations` map keyed by the time-dimension index.

interface SdmxJsonV21 {
  dataSets?: Array<{
    series?: Record<
      string,
      {
        observations?: Record<string, [number, ...unknown[]]>;
      }
    >;
  }>;
  structure?: {
    dimensions?: {
      observation?: Array<{
        id: string;
        values?: Array<{ id: string; name?: string }>;
      }>;
    };
  };
}

function pickLatestObservation(
  payload: SdmxJsonV21
): { value: number; period: string } | null {
  const series = payload?.dataSets?.[0]?.series;
  if (!series) return null;
  const timeDim = payload?.structure?.dimensions?.observation?.find(
    (d) => d.id === 'TIME_PERIOD'
  );
  const timeValues = timeDim?.values ?? [];
  let bestIdx = -1;
  let bestValue: number | null = null;
  for (const s of Object.values(series)) {
    for (const [obsKey, obs] of Object.entries(s.observations ?? {})) {
      const idx = Number(obsKey);
      if (!Number.isFinite(idx)) continue;
      const val = obs?.[0];
      if (typeof val !== 'number' || !Number.isFinite(val)) continue;
      if (idx > bestIdx) {
        bestIdx = idx;
        bestValue = val;
      }
    }
  }
  if (bestValue === null || bestIdx < 0) return null;
  const period = timeValues[bestIdx]?.id ?? `idx${bestIdx}`;
  return { value: bestValue, period };
}

export interface ECBSnapshot {
  rate: number;
  period: string;
  source: 'ecb';
  series: string;
  fetchedAt: string;
}

/**
 * ECB main refinancing rate (MRR) — daily series, picks the most
 * recent published rate. SDMX series key:
 *   FM/D.U2.EUR.4F.KR.MRR_FR.LEV
 */
export async function fetchECBRate(): Promise<
  | { ok: true; data: ECBSnapshot }
  | { ok: false; reason: string; detail?: string }
> {
  const url =
    'https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.MRR_FR.LEV?format=jsondata&lastNObservations=12';
  const r = await fetchJsonSafe<SdmxJsonV21>({
    url,
    revalidate: REVALIDATE_SHORT,
  });
  if (!r.ok) return r;
  const latest = pickLatestObservation(r.data);
  if (!latest) {
    return { ok: false, reason: 'parse_error', detail: 'no observation' };
  }
  return {
    ok: true,
    data: {
      rate: Math.round(latest.value * 100) / 100,
      period: latest.period,
      source: 'ecb',
      series: 'FM/D.U2.EUR.4F.KR.MRR_FR.LEV',
      fetchedAt: new Date().toISOString(),
    },
  };
}

/**
 * DE HICP inflation, annual rate of change, monthly. SDMX series key:
 *   ICP/M.DE.N.000000.4.ANR
 */
export async function fetchDEInflation(): Promise<
  | { ok: true; data: ECBSnapshot }
  | { ok: false; reason: string; detail?: string }
> {
  const url =
    'https://data-api.ecb.europa.eu/service/data/ICP/M.DE.N.000000.4.ANR?format=jsondata&lastNObservations=24';
  const r = await fetchJsonSafe<SdmxJsonV21>({ url });
  if (!r.ok) return r;
  const latest = pickLatestObservation(r.data);
  if (!latest) {
    return { ok: false, reason: 'parse_error', detail: 'no observation' };
  }
  return {
    ok: true,
    data: {
      rate: Math.round(latest.value * 100) / 100,
      period: latest.period,
      source: 'ecb',
      series: 'ICP/M.DE.N.000000.4.ANR',
      fetchedAt: new Date().toISOString(),
    },
  };
}

// -----------------------------------------------------------------------------
// Eurostat · Job vacancy rate (jvs_q_isco) — quarterly
// -----------------------------------------------------------------------------

const EUROSTAT_BASE =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

interface JsonStatLite {
  value?: Record<string, number> | number[];
  dimension?: {
    time?: { category?: { index?: Record<string, number> } };
    geo?: { category?: { index?: Record<string, number> } };
  };
}

function parseLatestEurostat(
  payload: JsonStatLite
): { value: number; period: string } | null {
  const idx = payload?.dimension?.time?.category?.index;
  const values = payload?.value;
  if (!idx || !values) return null;
  const sorted = Object.entries(idx).sort(
    (a, b) => (b[1] as number) - (a[1] as number)
  );
  for (const [period, pos] of sorted) {
    const v = Array.isArray(values) ? values[pos] : values[String(pos)];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return { value: Math.round(v * 100) / 100, period };
    }
  }
  return null;
}

export interface EurostatSnapshot {
  rate: number;
  period: string;
  source: 'eurostat';
  indicator: string;
  fetchedAt: string;
}

/**
 * DE job vacancy rate (jvs_q_nace2). NACE Rev.2 total business
 * economy. Quarterly. Indicates how many of 100 job-positions are
 * currently open — a direct proxy for hiring tightness.
 *
 * Eurostat is picky about which dimensions are valid for which
 * dataset; we omit `sizeclas` (which `jvs_q_nace2` doesn't carry)
 * and stick to the four required dimensions: geo, nace_r2, s_adj,
 * unit. Falls back to NSA if the SA series has no data.
 */
export async function fetchDEJobVacancyRate(): Promise<
  | { ok: true; data: EurostatSnapshot }
  | { ok: false; reason: string; detail?: string }
> {
  // jvs_q_nace2 dimensions: geo, indic_em, nace_r2, s_adj, sizeclas
  // (no `unit` dimension — vacancy rate is the inherent unit).
  const tryOne = async (sAdj: 'SA' | 'NSA') => {
    const url = `${EUROSTAT_BASE}/jvs_q_nace2?geo=DE&nace_r2=B-S&s_adj=${sAdj}&sizeclas=TOTAL&indic_em=JOBRATE&lang=EN`;
    const r = await fetchJsonSafe<JsonStatLite>({ url });
    if (!r.ok) return r;
    const latest = parseLatestEurostat(r.data);
    if (!latest) return { ok: false as const, reason: 'parse_error' as const };
    return {
      ok: true as const,
      data: {
        rate: latest.value,
        period: latest.period,
        source: 'eurostat' as const,
        indicator: `jvs_q_nace2 · DE · B-S · ${sAdj} · JOBRATE`,
        fetchedAt: new Date().toISOString(),
      },
    };
  };
  const sa = await tryOne('SA');
  if (sa.ok) return sa;
  return tryOne('NSA');
}

/**
 * DE employment rate (15-64). Quarterly. From Eurostat
 * `lfsi_emp_q`. % of working-age population in paid work — cap is
 * naturally ~80%, watch the *trend* more than the absolute level.
 */
export async function fetchDEEmploymentRate(): Promise<
  | { ok: true; data: EurostatSnapshot }
  | { ok: false; reason: string; detail?: string }
> {
  const url =
    `${EUROSTAT_BASE}/lfsi_emp_q?geo=DE&age=Y15-64&sex=T&unit=PC_POP&s_adj=SA&indic_em=EMP_LFS&lang=EN`;
  const r = await fetchJsonSafe<JsonStatLite>({ url });
  if (!r.ok) return r;
  const latest = parseLatestEurostat(r.data);
  if (!latest) {
    return { ok: false, reason: 'parse_error', detail: 'no observation' };
  }
  return {
    ok: true,
    data: {
      rate: latest.value,
      period: latest.period,
      source: 'eurostat',
      indicator: 'lfsi_emp_q · DE · 15-64 · SA · EMP_LFS',
      fetchedAt: new Date().toISOString(),
    },
  };
}

// -----------------------------------------------------------------------------
// OECD · Composite Leading Indicator (Germany)
// -----------------------------------------------------------------------------
//
// Lead-of-3-to-6 months for turning points in industrial production.
// SDMX-JSON v1 (older format). Endpoint:
//   https://stats.oecd.org/sdmx-json/data/MEI_CLI/LOLITONO.DEU.M/all
//
// Returns a single time-series; we pick the latest observation.

interface OecdSdmxV1 {
  dataSets?: Array<{
    series?: Record<
      string,
      { observations?: Record<string, [number, ...unknown[]]> }
    >;
  }>;
  structure?: {
    dimensions?: {
      observation?: Array<{
        id: string;
        values?: Array<{ id: string; name?: string }>;
      }>;
    };
  };
}

export interface OECDSnapshot {
  value: number;
  period: string;
  source: 'oecd';
  indicator: string;
  /** Trend reading 1m/3m/6m vs reference 100. */
  trend: 'expanding' | 'slowing' | 'contracting' | 'recovering' | 'flat';
  fetchedAt: string;
}

function classifyCli(latest: number, prev?: number): OECDSnapshot['trend'] {
  if (prev === undefined) {
    return latest >= 100 ? 'expanding' : 'contracting';
  }
  const delta = latest - prev;
  if (latest >= 100 && delta >= 0.05) return 'expanding';
  if (latest >= 100 && delta < -0.05) return 'slowing';
  if (latest < 100 && delta >= 0.05) return 'recovering';
  if (latest < 100 && delta < -0.05) return 'contracting';
  return 'flat';
}

export async function fetchDECompositeLeadingIndicator(): Promise<
  | { ok: true; data: OECDSnapshot }
  | { ok: false; reason: string; detail?: string }
> {
  // OECD migrated stats.oecd.org → sdmx.oecd.org in 2024. The new
  // SDMX-JSON endpoint follows the same payload shape (dataSets +
  // observation dimensions), but the dataflow id is verbose.
  // Falls back to the legacy endpoint for graceful coverage.
  const newUrl =
    'https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI,4.0/DEU.M.LI...AA...H?lastNObservations=24';
  const legacyUrl =
    'https://stats.oecd.org/sdmx-json/data/MEI_CLI/LOLITONO.DEU.M/all?lastNObservations=24';
  const r =
    (await fetchJsonSafe<OecdSdmxV1>({ url: newUrl })).ok
      ? await fetchJsonSafe<OecdSdmxV1>({ url: newUrl })
      : await fetchJsonSafe<OecdSdmxV1>({ url: legacyUrl });
  if (!r.ok) return r;
  const series = r.data?.dataSets?.[0]?.series;
  if (!series) return { ok: false, reason: 'parse_error' };
  const timeDim = r.data?.structure?.dimensions?.observation?.find(
    (d) => d.id === 'TIME_PERIOD'
  );
  const timeValues = timeDim?.values ?? [];

  // Single key in a single-series response — grab it
  const onlySeries = Object.values(series)[0];
  const obs = onlySeries?.observations ?? {};
  const sorted = Object.entries(obs)
    .map(([k, v]) => ({ idx: Number(k), val: v?.[0] }))
    .filter((x) => Number.isFinite(x.idx) && typeof x.val === 'number')
    .sort((a, b) => b.idx - a.idx);

  if (sorted.length === 0) return { ok: false, reason: 'parse_error' };
  const latest = sorted[0];
  const prev = sorted[1];
  const period = timeValues[latest.idx]?.id ?? `idx${latest.idx}`;
  return {
    ok: true,
    data: {
      value: Math.round((latest.val as number) * 100) / 100,
      period,
      source: 'oecd',
      indicator: 'MEI_CLI · LOLITONO · DEU · monthly',
      trend: classifyCli(latest.val as number, prev?.val as number | undefined),
      fetchedAt: new Date().toISOString(),
    },
  };
}
