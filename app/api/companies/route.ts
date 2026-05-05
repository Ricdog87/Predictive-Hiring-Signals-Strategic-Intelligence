import { getCompanies } from '../../../lib/mockData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  const data = await getCompanies();
  return Response.json({ data, generatedAt: new Date().toISOString() });
}
