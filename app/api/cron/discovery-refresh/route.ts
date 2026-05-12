/**
 * GET /api/cron/discovery-refresh
 *
 * Scheduled trigger that pre-warms both Discovery missions and the
 * Bundesagentur snapshot. Runs every 6 hours (see vercel.json crons).
 *
 * Auth — two acceptable paths:
 *   1. Vercel scheduler:  request carries `x-vercel-cron: 1`
 *   2. Manual / external: `Authorization: Bearer ${CRON_SECRET}`
 *
 * Either header alone passes. If CRON_SECRET is unset and the
 * x-vercel-cron header is missing → 503 (deployment misconfigured).
 *
 * Whitelabel: customer-facing surfaces never call this route; the cron
 * is internal-only and only refreshes upstream caches.
 */

import { NextRequest } from 'next/server';
import { fetchAllCategories } from '@/lib/bundesagenturAdapter';
import { isAnthropicDiscoveryConfigured } from '@/lib/anthropicDiscovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorise(req: NextRequest): { ok: true } | { ok: false; status: number; reason: string } {
  const vercelCron = req.headers.get('x-vercel-cron');
  const expected = process.env.CRON_SECRET?.trim();
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (vercelCron) return { ok: true };
  if (expected && bearer && bearer === expected) return { ok: true };
  if (!expected && !vercelCron) {
    return { ok: false, status: 503, reason: 'CRON_SECRET not configured and no x-vercel-cron header' };
  }
  return { ok: false, status: 401, reason: 'missing or invalid bearer' };
}

interface RefreshReport {
  ok: true;
  runAt: string;
  ba: {
    categoriesOk: number;
    categoriesError: number;
    totalPostings: number;
  };
  discovery: {
    configured: boolean;
    note: string;
  };
  durationMs: number;
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = authorise(req);
  if (!auth.ok) {
    return Response.json(
      { ok: false, reason: auth.reason },
      { status: auth.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const startedAt = Date.now();

  // 1. Force-refresh Bundesagentur snapshots — parallel, never throws.
  const ba = await fetchAllCategories({ force: true });
  const totalPostings = ba.categories.reduce((acc, c) => acc + c.postings, 0);

  // 2. Discovery refresh is intentionally lazy: the Anthropic mission
  //    only fires when /api/intel/snapshot consumers ask for it. We
  //    don't pre-warm it from the cron path to keep token spend
  //    bounded and deterministic. Report status only.
  const discoveryConfigured = isAnthropicDiscoveryConfigured();

  const report: RefreshReport = {
    ok: true,
    runAt: new Date().toISOString(),
    ba: {
      categoriesOk: ba.categories.length,
      categoriesError: ba.errors.length,
      totalPostings,
    },
    discovery: {
      configured: discoveryConfigured,
      note: discoveryConfigured
        ? 'Lazy-fetched on first /api/intel/snapshot hit; cache TTL 6h.'
        : 'Set ANTHROPIC_DISCOVERY_ENABLED=true and ANTHROPIC_API_KEY to enable.',
    },
    durationMs: Date.now() - startedAt,
  };

  return Response.json(report, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
