/**
 * GET /api/jobs/ba-pulse
 *
 * Live job-volume snapshot per dashboard category, sourced from the
 * Bundesagentur für Arbeit public job-board API. Free, no auth, no
 * quota — see lib/bundesagenturAdapter.ts.
 *
 * Surfaces a CategorySnapshot[] identical in shape to the Adzuna
 * snapshot, plus an auto-discovered companies tail. Per-category
 * failures are isolated; the response never 5xx's.
 *
 * Whitelabel: customer-facing copy refers to this surface as
 * "DACH-Job-Quellen" — the upstream identity stays server-side.
 */

import { NextRequest } from 'next/server';
import {
  fetchAllCategories,
  discoverCompaniesFromSnapshot,
  fetchCategorySnapshot,
  BA_CATEGORY_QUERIES,
} from '@/lib/bundesagenturAdapter';
import type { JobCategoryId, CategorySnapshot, AggregatedJobRow } from '@/lib/jobMarketTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVALIDATE_SECONDS = 6 * 60 * 60; // 6h — matches the adapter cache

interface BaPulseResponse {
  ok: true;
  fetchedAt: string;
  categories: CategorySnapshot[];
  errors: Array<{ category: JobCategoryId; reason: string; detail?: string }>;
  companies: AggregatedJobRow[];
  totalPostings: number;
}

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  const single = url.searchParams.get('category') as JobCategoryId | null;

  // Single-category mode — useful for the JOBS-tab category-drill-in.
  if (single) {
    if (!(single in BA_CATEGORY_QUERIES)) {
      return Response.json(
        { ok: false, reason: 'bad_request', detail: `unknown category ${single}` },
        { status: 400 },
      );
    }
    const result = await fetchCategorySnapshot(single, { force });
    if (!result.ok) {
      return Response.json(
        { ok: false, reason: result.reason, detail: result.detail },
        { status: result.reason === 'timeout' ? 504 : 502 },
      );
    }
    return Response.json(
      {
        ok: true,
        fetchedAt: result.fetchedAt,
        category: result.data,
      },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS}`,
        },
      },
    );
  }

  // Bulk fetch — all 17 categories in parallel.
  const { categories, errors, fetchedAt } = await fetchAllCategories({ force });

  // Build a companies tail from the row-level data we already fetched.
  // We hit the adapter cache, so this is essentially free.
  const detailedAggregates = await Promise.all(
    categories.map((c) => fetchCategorySnapshot(c.category)),
  );
  const detailed = detailedAggregates
    .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
    .map((r) => r.data);
  const companies = discoverCompaniesFromSnapshot(detailed, 3).slice(0, 80);

  const totalPostings = categories.reduce((acc, c) => acc + c.postings, 0);

  const payload: BaPulseResponse = {
    ok: true,
    fetchedAt,
    categories,
    errors,
    companies,
    totalPostings,
  };

  return Response.json(payload, {
    headers: {
      'Cache-Control': `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS}`,
    },
  });
}
