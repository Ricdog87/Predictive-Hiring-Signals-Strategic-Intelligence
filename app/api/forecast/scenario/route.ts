/**
 * POST /api/forecast/scenario
 *
 * Premium-only. Live-Szenario-Forecast für eine Company via direkten LLM-Call
 * (OpenRouter mit Hermes-Whitelabel-Convention).
 *
 * Failure: gibt NIE 5xx in die UI durch. UI fallbackt auf statische Predictions
 * aus hiringForecast.ts.
 */

import { NextRequest } from 'next/server';
import {
  runDirectScenarioForecast,
  isForecastLlmConfigured,
  type ScenarioRequest,
} from '@/lib/forecastClient';
import { consumeForecastQuota } from '@/lib/forecastQuota';
import { checkApiKey, denyResponseFor } from '@/lib/apiKeys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // LLM-Pfad braucht 5-15s, Buffer für Edge-Fälle

const TIER_ALLOWLIST = () =>
  (process.env.FORECAST_TIER_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

interface Body {
  companyId?: unknown;
  prompt?: unknown;
  sector?: unknown;
  rounds?: unknown;
}

export async function POST(req: NextRequest): Promise<Response> {
  // ---- Auth (Repo-Convention: checkApiKey + denyResponseFor) ----
  const auth = checkApiKey(req);
  const deny = denyResponseFor(auth);
  if (deny) return deny;

  // auth.keyId ist der identifier, den wir für Quota + Tier-Allowlist nutzen
  const keyId =
    (auth as { keyId?: string; key?: string; id?: string }).keyId ??
    (auth as { keyId?: string; key?: string; id?: string }).key ??
    (auth as { keyId?: string; key?: string; id?: string }).id ??
    'anonymous';

  // ---- Tier-Gate (Allowlist via Env) ----
  // Wenn Allowlist leer ist, lassen wir alle Auth-Keys durch.
  // Sobald du Pro-Tiering aktiv hast, FORECAST_TIER_ALLOWLIST setzen.
  const allowlist = TIER_ALLOWLIST();
  if (allowlist.length > 0 && !allowlist.includes(keyId)) {
    return Response.json(
      {
        ok: false,
        reason: 'tier_required',
        message: 'Diese Funktion ist Teil des Pro-Plans.',
      },
      { status: 403 }
    );
  }

  // ---- LLM configured? ----
  if (!isForecastLlmConfigured()) {
    return Response.json({ ok: false, reason: 'unconfigured' }, { status: 503 });
  }

  // ---- Body ----
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  const companyId = String(body.companyId ?? '').trim();
  const prompt = String(body.prompt ?? '').trim();
  if (!companyId || !prompt) {
    return Response.json(
      { ok: false, reason: 'bad_request', detail: 'companyId and prompt required' },
      { status: 400 }
    );
  }
  if (prompt.length > 2000) {
    return Response.json(
      { ok: false, reason: 'bad_request', detail: 'prompt too long (max 2000)' },
      { status: 400 }
    );
  }

  const sector = typeof body.sector === 'string' ? body.sector : undefined;
  const rounds =
    typeof body.rounds === 'number' && Number.isFinite(body.rounds)
      ? Math.min(3, Math.max(1, Math.floor(body.rounds)))
      : undefined;

  // ---- Quota ----
  const q = consumeForecastQuota(keyId);
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
      }
    );
  }

  // ---- Upstream call ----
  const payload: ScenarioRequest = { companyId, prompt, sector, rounds };
  const result = await runDirectScenarioForecast(payload);

  if (!result.ok) {
    const httpStatus = result.reason === 'timeout' ? 504 : 502;
    return Response.json(
      { ok: false, reason: result.reason, latencyMs: result.latencyMs },
      { status: httpStatus }
    );
  }

  return Response.json(
    {
      ok: true,
      data: result.data,
      latencyMs: result.latencyMs,
      quota: { remaining: q.remaining, limit: q.limit, resetSec: q.resetSec },
    },
    {
      headers: {
        'X-RateLimit-Limit': String(q.limit),
        'X-RateLimit-Remaining': String(q.remaining),
        'X-RateLimit-Reset': String(q.resetSec),
        'Cache-Control': 'private, no-store',
      },
    }
  );
}
