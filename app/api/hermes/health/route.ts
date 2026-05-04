import { hermesHealth, isHermesConfigured } from '../../../../lib/hermesClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (!isHermesConfigured()) {
    return Response.json(
      {
        ok: false,
        configured: false,
        reason: 'unconfigured',
        detail: 'HERMES_BASE_URL not set on the radar',
        generatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  const r = await hermesHealth();
  if (!r.ok) {
    return Response.json(
      {
        ok: false,
        configured: true,
        reason: r.reason,
        detail: r.detail,
        generatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  return Response.json({
    ok: true,
    configured: true,
    upstream: r.data,
    generatedAt: new Date().toISOString(),
  });
}
