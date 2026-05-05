import { NextRequest } from 'next/server';
import {
  morningBrief,
  isHermesConfigured,
  type MorningBriefInput,
} from '../../../../lib/hermesClient';
import { stripVendor } from '../../../../lib/hermesClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: MorningBriefInput;
  try {
    body = (await req.json()) as MorningBriefInput;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
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

  const r = await morningBrief(body ?? {});
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
