import { NextRequest } from 'next/server';
import { getAggregates } from '../../../../lib/mockData';
import { listIngest } from '../../../../lib/ingestStore';
import { computeOpportunities } from '../../../../lib/opportunityEngine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get('limit') ?? '25'))
  );
  const minScore = Math.max(
    0,
    Math.min(100, Number(url.searchParams.get('minScore') ?? '0'))
  );

  const [aggregates, liveRecords] = await Promise.all([
    getAggregates(),
    listIngest(2000),
  ]);

  const data = computeOpportunities(
    { aggregates, liveRecords },
    { limit, minScore }
  );

  return Response.json({
    data,
    count: data.length,
    limit,
    minScore,
    generatedAt: new Date().toISOString(),
  });
}
