import { getCompanies } from '../../../lib/mockData';
import { rateLimit } from '../../../lib/rateLimit';

export const revalidate = 120;

export async function GET(req: Request) {
  const limited = rateLimit({ key: `companies:${req.headers.get('x-forwarded-for') ?? 'anon'}` });
  if (limited) return limited;

  const data = await getCompanies();
  return Response.json({ data, generatedAt: new Date().toISOString() });
}
