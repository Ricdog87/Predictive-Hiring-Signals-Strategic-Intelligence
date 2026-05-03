import { computeOpportunityFeed } from '../../../src/intelligence/opportunityFeed';
import { getAggregates } from '../../../lib/mockData';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = Math.max(1, Math.min(50, Number(limitParam) || 20));
  const aggregates = await getAggregates();
  const feed = computeOpportunityFeed(aggregates, limit);
  return Response.json({ data: feed, generatedAt: feed.generatedAt });
}
