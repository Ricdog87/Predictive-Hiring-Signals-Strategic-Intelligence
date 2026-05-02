import { getSignals } from '../../../lib/mockData';

export async function GET() {
  const data = await getSignals();
  return Response.json({ data, generatedAt: new Date().toISOString() });
}
