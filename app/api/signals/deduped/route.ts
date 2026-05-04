import { NextRequest } from 'next/server';
import { listIngest } from '../../../../lib/ingestStore';
import { dedupeSignals, dedupStats } from '../../../../lib/signalDedup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(2000, Number(url.searchParams.get('limit') ?? '500'))
  );

  const records = await listIngest(limit);
  const data = dedupeSignals(records);
  const stats = dedupStats(records);

  return Response.json({
    data,
    stats,
    count: data.length,
    rawCount: records.length,
    limit,
    generatedAt: new Date().toISOString(),
  });
}
