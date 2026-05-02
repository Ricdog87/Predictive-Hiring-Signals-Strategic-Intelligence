import { getCompanies } from '../../../lib/mockData';

export async function GET() {
  const data = await getCompanies();
  return Response.json({ data, generatedAt: new Date().toISOString() });
}
