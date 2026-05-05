import { getAggregates } from '../../../../../lib/mockData';
import { computeCompanyForecast } from '../../../../../lib/hiringForecast';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const aggregates = await getAggregates();
  const found = aggregates.find((a) => a.company.id === params.id);
  if (!found) {
    return Response.json(
      { ok: false, error: 'company not found' },
      { status: 404 }
    );
  }
  const forecast = computeCompanyForecast({ aggregate: found });
  return Response.json({
    ok: true,
    forecast,
    generatedAt: new Date().toISOString(),
  });
}
