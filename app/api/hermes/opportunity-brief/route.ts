import { NextRequest } from 'next/server';
import {
  generateOpportunityBrief,
  isHermesConfigured,
  type OpportunityBriefInput,
} from '../../../../lib/hermesClient';
import { stripVendor } from '../../../../lib/hermesClient';
import { getAggregates } from '../../../../lib/mockData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface IncomingBody extends Partial<OpportunityBriefInput> {
  /** When provided, the radar enriches the brief input with the
   *  aggregate it already has for this company (signals, score, etc.).
   *  Saves the caller from re-shaping data the radar can fetch itself. */
  companyId?: string;
}

export async function POST(req: NextRequest) {
  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  let payload: OpportunityBriefInput | null = null;

  if (body.companyId) {
    const aggregates = await getAggregates();
    const found = aggregates.find((a) => a.company.id === body.companyId);
    if (found) {
      payload = {
        companyId: found.company.id,
        companyName: found.company.name,
        industry: found.company.industry,
        region: found.company.headquarters,
        hiringScore: found.latestScore?.hiringScore,
        opportunityScore: body.opportunityScore,
        topSignals: body.topSignals,
        predictedRoles:
          body.predictedRoles ?? found.latestPrediction?.expectedRoleClusters,
        bestContactPersona: body.bestContactPersona,
        signals: found.signals.slice(0, 10).map((s) => ({
          signalType: s.signalType,
          title: typeof s.meta?.title === 'string' ? (s.meta.title as string) : undefined,
          impact: s.impact,
          confidence: s.confidence,
          observedAt: s.observedAt,
          source: s.provider,
        })),
      };
    }
  }

  if (!payload) {
    if (!body.companyName || !body.companyName.trim()) {
      return Response.json(
        { ok: false, error: 'companyName or known companyId required' },
        { status: 400 }
      );
    }
    payload = body as OpportunityBriefInput;
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

  const r = await generateOpportunityBrief(payload);
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
