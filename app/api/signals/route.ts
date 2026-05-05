import { getSignals } from '../../../lib/mockData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  const data = await getSignals();
  return Response.json({ data, generatedAt: new Date().toISOString() });
}
