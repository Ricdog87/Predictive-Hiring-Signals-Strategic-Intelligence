import { computeMarketClusters } from '../../../src/market/engine';
import { getAggregates, getCompanies, getSignals } from '../../../lib/mockData';

const sanitize = <T extends { data: Array<object> }>(payload: T) => ({
  ...payload,
  data: payload.data.filter((item) => {
    const values = Object.values(item).map((v) => String(v).toLowerCase());
    return !values.includes('unknown');
  }),
});

export const revalidate = 30;

export async function GET() {
  const [companies, signals, aggregates] = await Promise.all([getCompanies(), getSignals(), getAggregates()]);
  return Response.json(sanitize({ data: computeMarketClusters(companies, signals, aggregates), generatedAt: new Date().toISOString() }));
}
