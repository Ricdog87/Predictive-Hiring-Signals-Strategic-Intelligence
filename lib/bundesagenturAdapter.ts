/**
 * Bundesagentur für Arbeit job-board adapter · v1.
 *
 * Free public job-search API at
 *   https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs
 * The public demo `X-API-Key: jobboerse-jobsuche` is the documented way
 * to consume the v4 surface anonymously — no registration, no quota.
 *
 * Whitelabel: customer-facing surfaces should refer to this as
 * "DACH-Jobquellen · BA" or similar — never use the upstream's marketing
 * name. Internal log lines may use the full name.
 *
 * Why this exists: Adzuna covers ~6/17 of the dashboard's job categories
 * for Germany. The remaining 11 categories surface as N/A. BA gives us
 * full sector coverage at zero monthly cost.
 *
 * Cache: 6h. The BA job index doesn't churn meaningfully hour-to-hour.
 */

import type {
  JobCategoryId,
  CategorySnapshot,
  AggregatedJobRow,
} from './jobMarketTypes';

const BASE_URL =
  'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs';
const PUBLIC_API_KEY = 'jobboerse-jobsuche';
const DEFAULT_TIMEOUT_MS = Number(process.env.BA_JOBS_TIMEOUT_MS ?? 15_000);
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 4;
const CACHE_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Search-term map: 1-3 BA-Suchbegriffe per dashboard category. Tuned for
// reasonable recall without false-positives. Branches kept terse so the
// upstream querystring stays under 2 kB.
// ---------------------------------------------------------------------------

export const BA_CATEGORY_QUERIES: Record<JobCategoryId, readonly string[]> = {
  'it-jobs': ['Softwareentwickler', 'IT', 'DevOps'],
  'engineering-jobs': ['Ingenieur', 'Konstrukteur', 'Entwicklungsingenieur'],
  'sales-jobs': ['Vertrieb', 'Sales Manager', 'Account Manager'],
  'finance-jobs': ['Finance', 'Controlling', 'Treasury'],
  'accounting-finance-jobs': ['Buchhaltung', 'Bilanzbuchhalter', 'Accounting'],
  'legal-jobs': ['Jurist', 'Rechtsanwalt', 'Legal Counsel'],
  'pr-advertising-marketing-jobs': [
    'Marketing Manager',
    'Online Marketing',
    'PR Manager',
  ],
  'retail-jobs': ['Verkäufer', 'Filialleiter', 'Einzelhandel'],
  'manufacturing-jobs': ['Produktion', 'Fertigung', 'Industriemechaniker'],
  'logistics-warehouse-jobs': ['Logistik', 'Lagerist', 'Disponent'],
  'healthcare-nursing-jobs': ['Pflege', 'Krankenschwester', 'Pflegefachkraft'],
  'consultancy-jobs': ['Consultant', 'Unternehmensberater', 'Strategy'],
  'hr-jobs': ['Personal', 'HR Manager', 'Recruiter'],
  'creative-design-jobs': ['Designer', 'Grafiker', 'UX'],
  'energy-oil-gas-jobs': ['Energie', 'Versorgung', 'Netzbetrieb'],
  'scientific-qa-jobs': ['Qualitätssicherung', 'Labor', 'QA'],
  'trade-construction-jobs': ['Bau', 'Tiefbau', 'Handwerk'],
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BaJobResult {
  refnr: string;
  titel: string;
  arbeitgeber: string;
  arbeitsort: {
    plz?: string;
    ort?: string;
    region?: string;
  } | null;
  branche?: string;
  beruf?: string;
  modifikationsTimestamp?: string;
  externeUrl?: string;
}

export interface BaCategoryAggregate {
  category: JobCategoryId;
  query: string;
  postings: number;
  topCompanies: Array<{ name: string; postings: number }>;
  topLocations: Array<{ name: string; postings: number }>;
  rows: BaJobResult[];
  fetchedAt: string;
}

export type BaFailureReason =
  | 'timeout'
  | 'upstream'
  | 'network'
  | 'parse';

export type BaResult<T> =
  | { ok: true; data: T; fetchedAt: string }
  | { ok: false; reason: BaFailureReason; detail?: string };

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: BaCategoryAggregate;
  expiresAt: number;
}

const globalForCache = globalThis as unknown as {
  __rsgBaCache?: Map<string, CacheEntry>;
};
function cache(): Map<string, CacheEntry> {
  if (!globalForCache.__rsgBaCache) {
    globalForCache.__rsgBaCache = new Map();
  }
  return globalForCache.__rsgBaCache;
}

// ---------------------------------------------------------------------------
// Single-query fetch
// ---------------------------------------------------------------------------

interface BaApiResponse {
  stellenangebote?: Array<{
    refnr: string;
    titel?: string;
    arbeitgeber?: string;
    arbeitsort?: {
      plz?: string;
      ort?: string;
      region?: string;
    };
    branche?: string;
    beruf?: string;
    modifikationsTimestamp?: string;
    externeUrl?: string;
  }>;
  maxErgebnisse?: number;
  page?: number;
  size?: number;
}

/**
 * Fetch a single BA query, paginated. Returns up to `maxPages * size`
 * rows. The upstream's pagination is generous; the cap keeps a single
 * category snapshot at <= 1 MB of memory.
 */
export async function fetchBaJobs(
  query: string,
  opts: {
    pageSize?: number;
    maxPages?: number;
    timeoutMs?: number;
  } = {},
): Promise<BaResult<BaJobResult[]>> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const tmo = setTimeout(() => controller.abort(), timeoutMs);

  const fetchedAt = new Date().toISOString();
  const all: BaJobResult[] = [];
  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = new URL(BASE_URL);
      url.searchParams.set('was', query);
      url.searchParams.set('page', String(page));
      url.searchParams.set('size', String(pageSize));

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-API-Key': PUBLIC_API_KEY,
          Accept: 'application/json',
        },
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!res.ok) {
        if (res.status >= 500 && page === 1) {
          return {
            ok: false,
            reason: 'upstream',
            detail: `HTTP ${res.status}`,
          };
        }
        // a 404 / 4xx on a later page just means we've run out
        break;
      }

      const json = (await res.json().catch(() => null)) as
        | BaApiResponse
        | null;
      if (!json) {
        return { ok: false, reason: 'parse', detail: 'invalid JSON' };
      }

      const rows = json.stellenangebote ?? [];
      if (rows.length === 0) break;

      for (const r of rows) {
        if (!r.refnr) continue;
        all.push({
          refnr: r.refnr,
          titel: (r.titel ?? '').trim(),
          arbeitgeber: (r.arbeitgeber ?? '').trim(),
          arbeitsort: r.arbeitsort
            ? {
                plz: r.arbeitsort.plz,
                ort: r.arbeitsort.ort,
                region: r.arbeitsort.region,
              }
            : null,
          branche: r.branche,
          beruf: r.beruf,
          modifikationsTimestamp: r.modifikationsTimestamp,
          externeUrl: r.externeUrl,
        });
      }

      if (rows.length < pageSize) break;
    }

    return { ok: true, data: all, fetchedAt };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e?.name === 'AbortError') {
      return { ok: false, reason: 'timeout', detail: `>${timeoutMs}ms` };
    }
    return { ok: false, reason: 'network', detail: e?.message ?? 'unknown' };
  } finally {
    clearTimeout(tmo);
  }
}

// ---------------------------------------------------------------------------
// Aggregation per category
// ---------------------------------------------------------------------------

function aggregate(
  rows: BaJobResult[],
  cap = 8,
): {
  topCompanies: Array<{ name: string; postings: number }>;
  topLocations: Array<{ name: string; postings: number }>;
} {
  const byCompany = new Map<string, number>();
  const byLocation = new Map<string, number>();
  for (const r of rows) {
    const company = r.arbeitgeber.trim();
    if (company) byCompany.set(company, (byCompany.get(company) ?? 0) + 1);
    const loc = r.arbeitsort?.ort?.trim();
    if (loc) byLocation.set(loc, (byLocation.get(loc) ?? 0) + 1);
  }
  const topN = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, cap)
      .map(([name, postings]) => ({ name, postings }));
  return { topCompanies: topN(byCompany), topLocations: topN(byLocation) };
}

/**
 * Fetch + aggregate one dashboard category. Uses the first query in
 * BA_CATEGORY_QUERIES — multiple queries per category would multiply
 * upstream calls without much marginal recall.
 */
export async function fetchCategorySnapshot(
  category: JobCategoryId,
  opts: { force?: boolean; pageSize?: number; maxPages?: number } = {},
): Promise<BaResult<BaCategoryAggregate>> {
  const query = BA_CATEGORY_QUERIES[category]?.[0];
  if (!query) {
    return {
      ok: false,
      reason: 'parse',
      detail: `no query mapping for ${category}`,
    };
  }

  const cacheKey = `${category}:${query}`;
  const now = Date.now();
  if (!opts.force) {
    const hit = cache().get(cacheKey);
    if (hit && hit.expiresAt > now) {
      return { ok: true, data: hit.data, fetchedAt: hit.data.fetchedAt };
    }
  }

  const rowsRes = await fetchBaJobs(query, {
    pageSize: opts.pageSize,
    maxPages: opts.maxPages,
  });
  if (!rowsRes.ok) return rowsRes;

  const agg = aggregate(rowsRes.data);
  const snapshot: BaCategoryAggregate = {
    category,
    query,
    postings: rowsRes.data.length,
    topCompanies: agg.topCompanies,
    topLocations: agg.topLocations,
    rows: rowsRes.data.slice(0, 50),
    fetchedAt: rowsRes.fetchedAt,
  };

  cache().set(cacheKey, { data: snapshot, expiresAt: now + CACHE_MS });
  return { ok: true, data: snapshot, fetchedAt: rowsRes.fetchedAt };
}

/**
 * Fetch every dashboard category in parallel. Failures are isolated per
 * category — one upstream 5xx doesn't blank the whole snapshot.
 */
export async function fetchAllCategories(
  opts: { force?: boolean } = {},
): Promise<{
  categories: CategorySnapshot[];
  errors: Array<{ category: JobCategoryId; reason: BaFailureReason; detail?: string }>;
  fetchedAt: string;
}> {
  const fetchedAt = new Date().toISOString();
  const ids = Object.keys(BA_CATEGORY_QUERIES) as JobCategoryId[];

  const results = await Promise.all(
    ids.map(async (id) => ({
      id,
      result: await fetchCategorySnapshot(id, opts),
    })),
  );

  const categories: CategorySnapshot[] = [];
  const errors: Array<{
    category: JobCategoryId;
    reason: BaFailureReason;
    detail?: string;
  }> = [];

  for (const { id, result } of results) {
    if (!result.ok) {
      errors.push({ category: id, reason: result.reason, detail: result.detail });
      continue;
    }
    categories.push({
      category: id,
      postings: result.data.postings,
      meanSalary: null, // BA does not expose a uniform salary aggregate
      topCompanies: result.data.topCompanies,
      topLocations: result.data.topLocations,
      fetchedAt: result.data.fetchedAt,
    });
  }

  return { categories, errors, fetchedAt };
}

// ---------------------------------------------------------------------------
// Companies-auto-discovery from BA aggregate
// ---------------------------------------------------------------------------

/**
 * Pull unique companies with >= `minPostings` active BA postings out of
 * a snapshot. Useful for seeding the Companies-Radar with live mid-cap
 * names that no RSS-classifier would ever surface.
 */
export function discoverCompaniesFromSnapshot(
  categories: BaCategoryAggregate[],
  minPostings = 3,
): AggregatedJobRow[] {
  const byCompany = new Map<
    string,
    { categories: Set<JobCategoryId>; postings: number; sampleLocation?: string }
  >();

  for (const cat of categories) {
    for (const row of cat.rows) {
      const name = row.arbeitgeber.trim();
      if (!name) continue;
      const entry = byCompany.get(name) ?? {
        categories: new Set<JobCategoryId>(),
        postings: 0,
      };
      entry.categories.add(cat.category);
      entry.postings += 1;
      if (!entry.sampleLocation && row.arbeitsort?.ort) {
        entry.sampleLocation = row.arbeitsort.ort;
      }
      byCompany.set(name, entry);
    }
  }

  return Array.from(byCompany.entries())
    .filter(([, v]) => v.postings >= minPostings)
    .sort((a, b) => b[1].postings - a[1].postings)
    .map(([name, v]) => ({
      name,
      categories: Array.from(v.categories),
      postings: v.postings,
      sampleLocation: v.sampleLocation ?? null,
    }));
}
