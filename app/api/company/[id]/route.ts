import { getAggregates } from '../../../../lib/mockData';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const aggregates = await getAggregates();
  const found = aggregates.find((x) => x.company.id === params.id);
  if (!found) return Response.json({ error: 'company not found' }, { status: 404 });
  return Response.json({ data: found, generatedAt: new Date().toISOString() });
}
