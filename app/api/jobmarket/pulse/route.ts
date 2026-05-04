import { fetchAdzunaPulse, isAdzunaConfigured } from '../../../../lib/jobMarketSources';

export const runtime = 'nodejs';
export const revalidate = 1_800;

export async function GET() {
  if (!isAdzunaConfigured()) {
    return Response.json({
      ok: false,
      configured: false,
      reason: 'unconfigured',
      detail: 'ADZUNA_APP_ID / ADZUNA_APP_KEY not set on the radar',
      generatedAt: new Date().toISOString(),
    });
  }

  const r = await fetchAdzunaPulse();
  if (!r.ok) {
    return Response.json({
      ok: false,
      configured: true,
      reason: r.reason,
      detail: r.detail,
      generatedAt: new Date().toISOString(),
    });
  }
  return Response.json({
    ok: true,
    configured: true,
    ...r.data,
    generatedAt: new Date().toISOString(),
  });
}
