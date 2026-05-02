import { profiles } from '../../../lib/mockData';

export async function GET() {
  return Response.json({ data: profiles, generatedAt: new Date().toISOString() });
}
