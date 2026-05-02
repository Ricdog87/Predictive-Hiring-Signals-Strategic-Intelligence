import { getAggregates } from '../../../lib/mockData';

export async function GET() {
  const aggregates = await getAggregates();
  return Response.json({ data: aggregates.map((x) => x.latestPrediction), generatedAt: new Date().toISOString() });
}
