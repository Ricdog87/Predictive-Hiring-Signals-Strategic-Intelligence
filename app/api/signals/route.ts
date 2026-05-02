import { signals } from '../../../lib/mockData';

export async function GET() {
  return Response.json({ data: signals, generatedAt: new Date().toISOString() });
}
