import { NextRequest } from 'next/server';
import {
  morningBrief,
  isHermesConfigured,
  type MorningBriefInput,
} from '../../../../lib/hermesClient';

export const runtime = 'nodejs';
// Edge-cache the brief for 4 hours. One Sonar call serves every
// dashboard load in the window — keeps cost to ~$0.50/month at 1000
// daily users on the free tier of OpenRouter / Perplexity Sonar.
export const revalidate = 14_400;

/**
 * GET /api/intel/morning-brief?role=&industries=&regions=&watchlist=
 *
 * All query params are optional. CSV-encoded for industries / regions
 * / watchlist. Returns a structured JSON brief grounded in live web
 * sources (Sonar). Always returns 200 — body's `ok` flag tells the
 * caller whether the brief is real or a deterministic fallback.
 */
export async function GET(req: NextRequest) {
  if (!isHermesConfigured()) {
    return Response.json(
      {
        ok: false,
        fellBack: true,
        reason: 'unconfigured',
        detail:
          'HERMES_BASE_URL not set on the radar — daily brief will activate as soon as Hermes is reachable.',
        generatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  const url = new URL(req.url);
  const csv = (k: string) =>
    (url.searchParams.get(k) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const input: MorningBriefInput = {
    role: url.searchParams.get('role') ?? 'Senior Recruiter / Talent Acquisition Lead',
    locale: url.searchParams.get('locale') ?? 'de-DE',
    focusIndustries: csv('industries'),
    focusRegions: csv('regions').length > 0 ? csv('regions') : ['DACH', 'Deutschland'],
    watchlist: csv('watchlist'),
  };

  const r = await morningBrief(input);
  if (!r.ok) {
    return Response.json(
      {
        ok: false,
        fellBack: true,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
        generatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  return Response.json({
    ok: true,
    ...r.data,
    generatedAt: new Date().toISOString(),
  });
}
