import { fetchAllNews } from '../../../../lib/newsFetcher';
import { classifyNewsBatch } from '../../../../lib/newsClassifier';

export const runtime = 'nodejs';
// Edge-cache the response for 5 minutes — RSS sources don't move
// faster than that for our purposes, and this keeps us off their
// rate-limit radar.
export const revalidate = 300;

export async function GET() {
  const { items, feeds } = await fetchAllNews();
  const classified = classifyNewsBatch(items);

  return Response.json({
    ok: true,
    items: classified.slice(0, 30),
    classifiedCount: classified.length,
    rawCount: items.length,
    feeds,
    breakingCount: classified.filter((c) => c.breaking).length,
    generatedAt: new Date().toISOString(),
  });
}
