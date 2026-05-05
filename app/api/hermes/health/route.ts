import { hermesHealth, isHermesConfigured } from '../../../../lib/hermesClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (!(await isHermesConfigured())) {
    return Response.json(
      {
        ok: false,
        configured: false,
        reason: 'unconfigured',
        detail: 'RSG Intelligence Engine not configured',
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
