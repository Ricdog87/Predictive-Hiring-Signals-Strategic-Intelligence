/**
 * Job-market sources · v1.
 *
 * Adzuna is a public job aggregator with a free tier that covers
 * Germany. We use it to surface live job-posting *volume* per
 * sector / region — which is the closest proxy to "actual hiring
 * happening right now" we can get without paying for Indeed.
 *
 * Auth: APP_ID + APP_KEY from https://developer.adzuna.com/.
 * When either env var is missing, every method short-circuits to
 * `{ ok:false, reason:'unconfigured' }` — graceful fallback so the
 * dashboard never blanks.
 */

import { getConfig } from './runtimeConfig';

const TIMEOUT_MS = Number(process.env.ADZUNA_TIMEOUT_MS ?? 8_000);
const REVALIDATE_SECONDS = Number(process.env.ADZUNA_REVALIDATE_SECONDS ?? 1_800); // 30m

const COUNTRY = 'de';

async function appCreds(): Promise<{ id: string; key: string } | null> {
  const id = (await getConfig('ADZUNA_APP_ID'))?.trim();
  const key = (await getConfig('ADZUNA_APP_KEY'))?.trim();
  if (!id || !key) return null;
  return { id, key };
}

export async function isAdzunaConfigured(): Promise<boolean> {
  return (await appCreds()) !== null;
}

/** Sync probe — env-only, used by /api/health for the fast path. */
export function isAdzunaConfiguredSync(): boolean {
  return Boolean(
    process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim()
  );
}

/**
 * Adzuna documents NACE-style category slugs. Curated subset that
 * maps cleanly to our internal sector taxonomy.
 */
export const ADZUNA_CATEGORIES = [
  'it-jobs',
  'engineering-jobs',
  'sales-jobs',
  'finance-jobs',
  'manufacturing-jobs',
  'logistics-warehouse-jobs',
  'healthcare-nursing-jobs',
  'consultancy-jobs',
  'hr-jobs',
  'creative-design-jobs',
  'energy-oil-gas-jobs',
  'scientific-qa-jobs',
] as const;
export type AdzunaCategory = (typeof ADZUNA_CATEGORIES)[number];

interface AdzunaSearchResponse {
  count: number;
  mean?: number;
  results?: Array<{
    title: string;
    company?: { display_name?: string };
    location?: { display_name?: string };
    redirect_url?: string;
    salary_min?: number;
    salary_max?: number;
    created?: string;
  }>;
}

export interface AdzunaCategorySnapshot {
  category: AdzunaCategory;
  postings: number;
  meanSalary: number | null;
  topCompanies: Array<{ name: string; postings: number }>;
  topLocations: Array<{ name: string; postings: number }>;
  fetchedAt: string;
}

export interface AdzunaError {
  ok: false;
  reason: 'unconfigured' | 'timeout' | 'http_error' | 'network' | 'parse_error';
  detail?: string;
}

async function adzunaFetch<T>(
  path: string
): Promise<{ ok: true; data: T } | AdzunaError> {
  const creds = await appCreds();
  if (!creds) {
    return { ok: false, reason: 'unconfigured', detail: 'ADZUNA_APP_ID / ADZUNA_APP_KEY not set' };
  }
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://api.adzuna.com/v1/api${path}${sep}app_id=${encodeURIComponent(
    creds.id
  )}&app_key=${encodeURIComponent(creds.key)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, reason: 'http_error', detail: `${res.status}` };
    }
    try {
      return { ok: true, data: (await res.json()) as T };
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

/**
 * Fetch the first page (50 results) for a category and roll it up
 * into volume + salary + top companies + top cities. The total
 * `count` is the all-pages number, even though we only inspect the
 * first 50 for distribution.
 */
export async function fetchAdzunaCategory(
  category: AdzunaCategory,
  region?: string
): Promise<{ ok: true; data: AdzunaCategorySnapshot } | AdzunaError> {
  const params = new URLSearchParams({
    results_per_page: '50',
    category,
    sort_by: 'date',
  });
  if (region) params.set('where', region);
  const r = await adzunaFetch<AdzunaSearchResponse>(
    `/jobs/${COUNTRY}/search/1?${params.toString()}`
  );
  if (!r.ok) return r;

  const results = r.data.results ?? [];
  const compTotals = new Map<string, number>();
  const locTotals = new Map<string, number>();
  for (const job of results) {
    const c = job.company?.display_name?.trim();
    if (c) compTotals.set(c, (compTotals.get(c) ?? 0) + 1);
    const loc = job.location?.display_name?.split(',')[0]?.trim();
    if (loc) locTotals.set(loc, (locTotals.get(loc) ?? 0) + 1);
  }

  return {
    ok: true,
    data: {
      category,
      postings: r.data.count ?? 0,
      meanSalary:
        typeof r.data.mean === 'number' ? Math.round(r.data.mean) : null,
      topCompanies: Array.from(compTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, postings]) => ({ name, postings })),
      topLocations: Array.from(locTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, postings]) => ({ name, postings })),
      fetchedAt: new Date().toISOString(),
    },
  };
}

/**
 * Fan-out over all curated categories and roll them into a single
 * job-market pulse. Hard-bounded by the per-call timeout.
 */
export interface AdzunaPulse {
  totalPostings: number;
  byCategory: Array<{
    category: AdzunaCategory;
    postings: number;
    meanSalary: number | null;
  }>;
  topCompaniesAcross: Array<{ name: string; postings: number }>;
  fetchedAt: string;
}

export async function fetchAdzunaPulse(): Promise<
  { ok: true; data: AdzunaPulse } | AdzunaError
> {
  const creds = await appCreds();
  if (!creds) {
    return { ok: false, reason: 'unconfigured' };
  }
  const settled = await Promise.all(
    ADZUNA_CATEGORIES.map((c) => fetchAdzunaCategory(c))
  );
  const ok = settled.filter(
    (s): s is { ok: true; data: AdzunaCategorySnapshot } => s.ok
  );
  if (ok.length === 0) {
    return { ok: false, reason: 'http_error', detail: 'all categories failed' };
  }
  const compTotals = new Map<string, number>();
  for (const s of ok) {
    for (const c of s.data.topCompanies) {
      compTotals.set(c.name, (compTotals.get(c.name) ?? 0) + c.postings);
    }
  }
  return {
    ok: true,
    data: {
      totalPostings: ok.reduce((acc, s) => acc + s.data.postings, 0),
      byCategory: ok
        .map((s) => ({
          category: s.data.category,
          postings: s.data.postings,
          meanSalary: s.data.meanSalary,
        }))
        .sort((a, b) => b.postings - a.postings),
      topCompaniesAcross: Array.from(compTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, postings]) => ({ name, postings })),
      fetchedAt: new Date().toISOString(),
    },
  };
}
