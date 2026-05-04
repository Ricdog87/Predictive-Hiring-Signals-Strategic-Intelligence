import { NextRequest } from 'next/server';
import {
  researchCompany,
  isHermesConfigured,
  type CompanyResearchInput,
} from '../../../../lib/hermesClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: CompanyResearchInput;
  try {
    body = (await req.json()) as CompanyResearchInput;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!body || !body.query || !body.query.trim()) {
    return Response.json(
      { ok: false, error: 'query is required' },
      { status: 400 }
    );
  }

  if (!isHermesConfigured()) {
    return Response.json(
      {
        ok: false,
        fellBack: true,
        reason: 'unconfigured',
        detail: 'HERMES_BASE_URL not set on the radar',
      },
      { status: 200 }
    );
  }

  const r = await researchCompany(body);
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
    ...r.data,
    generatedAt: new Date().toISOString(),
  });
}
