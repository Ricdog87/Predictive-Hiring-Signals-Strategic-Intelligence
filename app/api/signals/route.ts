import { getSignals } from '../../../lib/mockData';
import { rateLimit } from '../../../lib/rateLimit';

export const revalidate = 120;

export async function GET(req: Request) {
  const limited = rateLimit({ key: `signals:${req.headers.get('x-forwarded-for') ?? 'anon'}` });
  if (limited) return limited;

  const data = await getSignals();
  return Response.json({ data, generatedAt: new Date().toISOString() });
}
