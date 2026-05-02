import { computeHiringScore } from '../../../lib/scoring';
import { getSignals } from '../../../lib/mockData';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId = url.searchParams.get('companyId');
  if (!companyId) return Response.json({ error: 'companyId query param is required' }, { status: 400 });
  const signals = await getSignals();
  return Response.json({ data: computeHiringScore(companyId, signals.filter((s) => s.companyId === companyId)), generatedAt: new Date().toISOString() });
}
