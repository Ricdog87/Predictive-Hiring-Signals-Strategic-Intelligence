import { NextRequest } from 'next/server';
import { buildIntelSnapshot } from '../../../../lib/intelSnapshot';
import {
  checkApiKey,
  denyResponseFor,
  isAuthEnforced,
  refreshKeys,
} from '../../../../lib/apiKeys';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Warm the API-key cache so admin-side rotations propagate within
  // the 60s TTL even without a redeploy.
  await refreshKeys();
  const auth = checkApiKey(req);
  const denied = denyResponseFor(auth);
  if (denied) return denied;

  const url = new URL(req.url);
  const topN = Math.max(1, Math.min(50, Number(url.searchParams.get('topN') ?? '10')));
  const newsLimit = Math.max(1, Math.min(30, Number(url.searchParams.get('news') ?? '8')));
  const skipNetworkFetches = url.searchParams.get('lite') === '1';

  const snapshot = await buildIntelSnapshot({ topN, newsLimit, skipNetworkFetches });

  return new Response(
    JSON.stringify({
      ok: true,
      auth: {
        enforced: isAuthEnforced(),
        keyId: auth.keyId,
      },
      ...snapshot,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...auth.headers,
      },
    }
  );
}
