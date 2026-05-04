import { NextRequest } from 'next/server';
import { isIngestStoreUsingKv, listIngest } from '../../../../lib/ingestStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(500, Number(url.searchParams.get('limit') ?? '50'))
  );

  const records = await listIngest(limit);

  return Response.json({
    data: records,
    count: records.length,
    limit,
    store: isIngestStoreUsingKv() ? 'kv' : 'memory',
    generatedAt: new Date().toISOString(),
  });
}
