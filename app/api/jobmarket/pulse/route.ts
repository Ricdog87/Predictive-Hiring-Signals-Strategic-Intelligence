/**
 * GET /api/jobmarket/pulse
 *
 * Merged dashboard endpoint. Combines:
 *   - Bundesagentur für Arbeit (primary — fills every category, real
 *     Mittelstand employer names, no auth)
 *   - Adzuna (secondary — better mean-salary coverage; preserved as a
 *     fallback so the route still works on deployments without the
 *     BA reach we added in PR #19)
 *
 * Merge policy (per category):
 *   postings      = BA if > 0, else Adzuna ?? 0
 *   meanSalary    = BA ?? Adzuna ?? null
 *   topCompanies  = BA if non-empty, else Adzuna ?? []
 *   topLocations  = BA if non-empty, else Adzuna ?? []
 *   source        = "BA" | "ADZUNA" | "UNAVAILABLE"
 *
 * Source failures are isolated — one upstream collapsing never blanks
 * the response. The route always returns 200 with `ok: true` plus
 * unavailability flags inline.
 *
 * Whitelabel: customer-facing surfaces refer to this as "DACH Job-
 * Quellen" — the upstream identities (BA, Adzuna) appear as
 * three-letter source tags only. No vendor URL in the JSON envelope.
 */

import {
  fetchAdzunaPulse,
  isAdzunaConfigured,
  ADZUNA_CATEGORIES,
  type AdzunaCategory,
} from '@/lib/jobMarketSources';
import {
  fetchAllCategories,
  fetchCategorySnapshot,
} from '@/lib/bundesagenturAdapter';
import type { JobCategoryId } from '@/lib/jobMarketTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 1_800;

const CACHE_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export type CategorySource = 'BA' | 'ADZUNA' | 'UNAVAILABLE';

export interface MergedCategoryRow {
  category: JobCategoryId;
  postings: number;
  meanSalary: number | null;
  topCompanies: Array<{ name: string; postings: number }>;
  topLocations: Array<{ name: string; postings: number }>;
  source: CategorySource;
  unavailable: boolean;
}

export interface JobmarketPulseResponse {
  ok: true;
  configured: boolean;
  totalPostings: number;
  byCategory: MergedCategoryRow[];
  topCompaniesAcross: Array<{ name: string; postings: number }>;
  okCount: number;
  totalCategories: number;
  sources: {
    ba: 'ok' | 'partial' | 'down';
    adzuna: 'ok' | 'partial' | 'down' | 'unconfigured';
  };
  fetchedAt: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// In-memory cache — keeps the merged result fresh for 6 h so the
// dashboard's no-store fetches don't trip the BA pagination loop on
// every page reload.
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: JobmarketPulseResponse;
  expiresAt: number;
}
const globalForCache = globalThis as unknown as {
  __rsgJobmarketCache?: CacheEntry;
};

function readCache(force: boolean): JobmarketPulseResponse | null {
  if (force) return null;
  const hit = globalForCache.__rsgJobmarketCache;
  if (hit && hit.expiresAt > Date.now()) return hit.data;
  return null;
}

function writeCache(data: JobmarketPulseResponse): void {
  globalForCache.__rsgJobmarketCache = {
    data,
    expiresAt: Date.now() + CACHE_MS,
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';

  const cached = readCache(force);
  if (cached) {
    return Response.json(cached, {
      headers: {
        'Cache-Control': `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate}`,
      },
    });
  }

  // Kick both upstreams in parallel. allSettled so one collapse never
  // takes the other down.
  const adzunaConfigured = await isAdzunaConfigured();
  const [baSettled, adzunaSettled] = await Promise.allSettled([
    fetchAllCategories({ force }),
    adzunaConfigured ? fetchAdzunaPulse() : Promise.resolve(null),
  ]);

  const ba =
    baSettled.status === 'fulfilled'
      ? baSettled.value
      : { categories: [], errors: [], fetchedAt: new Date().toISOString() };
  const adzuna =
    adzunaSettled.status === 'fulfilled' && adzunaSettled.value && adzunaSettled.value.ok
      ? adzunaSettled.value.data
      : null;

  const baByCategory = new Map(ba.categories.map((c) => [c.category, c]));
  const adzunaByCategory = new Map(
    (adzuna?.byCategory ?? []).map((c) => [c.category as AdzunaCategory, c]),
  );

  // Pull the row-level BA aggregates so we can extract topCompanies /
  // topLocations without a second pagination pass. The adapter cache
  // makes this essentially free.
  const detailedBa = await Promise.all(
    ba.categories.map((c) =>
      fetchCategorySnapshot(c.category, { force: false }),
    ),
  );
  const detailedBaByCategory = new Map(
    detailedBa
      .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
      .map((r) => [r.data.category, r.data]),
  );

  // Build one row per declared category. We iterate ADZUNA_CATEGORIES
  // because that is the canonical taxonomy the UI renders — the BA
  // adapter uses the same set.
  const rows: MergedCategoryRow[] = ADZUNA_CATEGORIES.map((cat) => {
    const baRow = baByCategory.get(cat);
    const baDetail = detailedBaByCategory.get(cat);
    const adzunaRow = adzunaByCategory.get(cat);

    const baPostings = baRow?.postings ?? 0;
    const adzunaPostings = adzunaRow?.postings ?? 0;

    let postings = 0;
    let source: CategorySource = 'UNAVAILABLE';
    let topCompanies: Array<{ name: string; postings: number }> = [];
    let topLocations: Array<{ name: string; postings: number }> = [];

    if (baPostings > 0) {
      postings = baPostings;
      source = 'BA';
      topCompanies = baDetail?.topCompanies ?? baRow?.topCompanies ?? [];
      topLocations = baDetail?.topLocations ?? baRow?.topLocations ?? [];
    } else if (adzunaPostings > 0 && adzunaRow && !adzunaRow.unavailable) {
      postings = adzunaPostings;
      source = 'ADZUNA';
      // Adzuna's pulse aggregate does not expose per-category top
      // companies / locations on this surface — leave empty rather
      // than fabricate.
    }

    const meanSalary =
      baRow?.meanSalary ?? adzunaRow?.meanSalary ?? null;

    return {
      category: cat as JobCategoryId,
      postings,
      meanSalary,
      topCompanies,
      topLocations,
      source,
      unavailable: source === 'UNAVAILABLE',
    };
  });

  rows.sort((a, b) => {
    if (a.unavailable !== b.unavailable) return a.unavailable ? 1 : -1;
    return b.postings - a.postings;
  });

  // Roll up top employers across all categories using whichever source
  // we ended up trusting per row. BA wins the long tail because it
  // surfaces real employer names.
  const acrossTotals = new Map<string, number>();
  for (const row of rows) {
    for (const c of row.topCompanies) {
      acrossTotals.set(c.name, (acrossTotals.get(c.name) ?? 0) + c.postings);
    }
  }
  // If BA delivered nothing for any row, fall back to Adzuna's roll-up.
  let topCompaniesAcross =
    acrossTotals.size > 0
      ? Array.from(acrossTotals.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([name, postings]) => ({ name, postings }))
      : (adzuna?.topCompaniesAcross ?? []).slice(0, 15);

  // Limit the rollup to 15 employers — anything beyond noise.
  topCompaniesAcross = topCompaniesAcross.slice(0, 15);

  const okCount = rows.filter((r) => !r.unavailable).length;
  const totalPostings = rows.reduce((acc, r) => acc + r.postings, 0);

  const baStatus =
    ba.categories.length === ADZUNA_CATEGORIES.length
      ? ('ok' as const)
      : ba.categories.length === 0
      ? ('down' as const)
      : ('partial' as const);
  const adzunaStatus = !adzunaConfigured
    ? ('unconfigured' as const)
    : !adzuna
    ? ('down' as const)
    : (adzuna.byCategory ?? []).every((c) => !c.unavailable)
    ? ('ok' as const)
    : ('partial' as const);

  const response: JobmarketPulseResponse = {
    ok: true,
    configured: ba.categories.length > 0 || adzunaConfigured,
    totalPostings,
    byCategory: rows,
    topCompaniesAcross,
    okCount,
    totalCategories: ADZUNA_CATEGORIES.length,
    sources: { ba: baStatus, adzuna: adzunaStatus },
    fetchedAt: ba.fetchedAt,
    generatedAt: new Date().toISOString(),
  };

  writeCache(response);

  return Response.json(response, {
    headers: {
      'Cache-Control': `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate}`,
    },
  });
}
