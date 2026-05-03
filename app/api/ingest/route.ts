import { checkRateLimit } from '@/lib/rateLimiter';

export async function POST(request: Request) {
  const client = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'local';
  if (!checkRateLimit(`ingest:${client}`, 20, 60_000)) {
    return Response.json({ error: 'rate_limited' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  return Response.json({ accepted: true, receivedAt: new Date().toISOString(), payload });
}
