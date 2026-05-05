import { computeMarketOverview } from '../../../src/market/engine';
import { getAggregates, getCompanies, getSignals } from '../../../lib/mockData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  const [companies, signals, aggregates] = await Promise.all([getCompanies(), getSignals(), getAggregates()]);
  return Response.json({ data: computeMarketOverview(companies, signals, aggregates), generatedAt: new Date().toISOString() });
}
