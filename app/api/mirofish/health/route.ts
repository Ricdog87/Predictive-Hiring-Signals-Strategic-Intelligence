import {
  isMirofishConfigured,
  mirofishHealth,
} from '../../../../lib/mirofishClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (!isMirofishConfigured()) {
    return Response.json({
      ok: true,
      configured: false,
      stub: true,
      service: 'mirofish',
      reason: 'not_required',
      detail:
        'MIROFISH_BASE_URL not set on the radar. MiroFish is optional in v1; the dashboard does not depend on it.',
      generatedAt: new Date().toISOString(),
    });
  }

  const r = await mirofishHealth();
  if (!r.ok) {
    return Response.json({
      ok: false,
      configured: true,
      stub: false,
      reason: r.reason,
      detail: r.detail,
      generatedAt: new Date().toISOString(),
    });
  }
  return Response.json({
    ok: true,
    configured: true,
    stub: false,
    upstream: r.data,
    generatedAt: new Date().toISOString(),
  });
}
