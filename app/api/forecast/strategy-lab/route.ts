/**
 * POST /api/forecast/strategy-lab
 *
 * Premium-only. Multi-Agent-Strategie-Lab: ein Mega-Call gegen ein
 * Frontier-Modell via OpenRouter (Whitelabel: Hermes). Liefert
 * Predictions + Vertriebs-Actions + Risiken für DACH-Recruiter.
 *
 * Failure-Mode: gibt NIE 5xx in die UI durch — alle Fehler sind als
 * { ok: false, reason } im 200/4xx-Pfad maskiert, ausser bei harten
 * Upstream-Crashes (502/504), die der UI eine spezifische Recovery
 * erlauben.
 */

import { NextRequest } from 'next/server';
import {
  runHermesStrategyLab,
  scrubStrategyLabResult,
  isStrategyLabConfigured,
  type StrategyLabInput,
} from '@/lib/strategyLab';
import { consumeStrategyLabQuota } from '@/lib/strategyLabQuota';
import { checkApiKey, denyResponseFor } from '@/lib/apiKeys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TIER_ALLOWLIST = () =>
  (process.env.STRATEGY_LAB_TIER_ALLOWLIST ?? process.env.FORECAST_TIER_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export async function POST(req: NextRequest): Promise<Response> {
  // ---- Auth ----
  const auth = checkApiKey(req);
  const deny = denyResponseFor(auth);
  if (deny) return deny;

  const keyId =
    (auth as { keyId?: string; key?: string; id?: string }).keyId ??
    (auth as { keyId?: string; key?: string; id?: string }).key ??
    'anonymous';

  // ---- Tier-Gate ----
  const allowlist = TIER_ALLOWLIST();
  if (allowlist.length > 0 && !allowlist.includes(keyId)) {
    return Response.json(
      {
        ok: false,
        reason: 'tier_required',
        message: 'Diese Funktion ist Teil des Pro-Plans.',
      },
      { status: 403 },
    );
  }

  // ---- Configured? ----
  if (!isStrategyLabConfigured()) {
    return Response.json({ ok: false, reason: 'unconfigured' }, { status: 503 });
  }

  // ---- Body ----
  let body: Partial<StrategyLabInput>;
  try {
    body = (await req.json()) as Partial<StrategyLabInput>;
  } catch {
    return Response.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  // ---- Quota ----
  const q = consumeStrategyLabQuota(keyId);
  if (!q.ok) {
    return Response.json(
      {
        ok: false,
        reason: 'quota_exceeded',
        limit: q.limit,
        resetSec: q.resetSec,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(q.resetSec),
          'X-RateLimit-Limit': String(q.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(q.resetSec),
        },
      },
    );
  }

  // ---- Upstream call ----
  const result = await runHermesStrategyLab(body);

  if (!result.ok) {
    if (result.reason === 'validation') {
      return Response.json(
        { ok: false, reason: 'validation', detail: result.detail },
        { status: 400 },
      );
    }
    if (result.reason === 'unconfigured') {
      return Response.json({ ok: false, reason: 'unconfigured' }, { status: 503 });
    }
    const status =
      result.reason === 'timeout' ? 504
      : result.reason === 'upstream' ? 502
      : result.reason === 'parse' ? 502
      : 502;
    return Response.json(
      { ok: false, reason: result.reason, detail: result.detail },
      { status },
    );
  }

  const scrubbed = scrubStrategyLabResult(result.data);

  return Response.json(
    {
      ok: true,
      data: scrubbed,
      quota: { remaining: q.remaining, limit: q.limit, resetSec: q.resetSec },
    },
    {
      headers: {
        'X-RateLimit-Limit': String(q.limit),
        'X-RateLimit-Remaining': String(q.remaining),
        'X-RateLimit-Reset': String(q.resetSec),
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
