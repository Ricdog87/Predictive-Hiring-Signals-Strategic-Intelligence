import { NextRequest } from 'next/server';
import {
  regionalInsight,
  isHermesConfigured,
  type RegionalInsightInput,
} from '../../../../lib/hermesClient';
import { stripVendor } from '../../../../lib/hermesClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: RegionalInsightInput;
  try {
    body = (await req.json()) as RegionalInsightInput;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!body || (!body.region && !body.label)) {
    return Response.json(
      { ok: false, error: 'region or label required' },
      { status: 400 }
    );
  }

  if (!(await isHermesConfigured())) {
    return Response.json(
      {
        ok: false,
        fellBack: true,
        reason: 'unconfigured',
        detail: 'RSG Intelligence Engine not configured',
      },
      { status: 200 }
    );
  }

  const r = await regionalInsight(body);
  if (!r.ok) {
    return Response.json(
      {
        ok: false,
        fellBack: true,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
      },
      { status: 200 }
    );
  }
  return Response.json({
    ok: true,
    ...stripVendor(r.data as unknown as Record<string, unknown>),
    generatedAt: new Date().toISOString(),
  });
}
