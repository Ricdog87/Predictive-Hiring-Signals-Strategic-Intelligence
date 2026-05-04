/**
 * External API-key gate · v1.
 *
 * Foundation for the upcoming paid tier. Reads a comma-separated list
 * of accepted bearer keys from `EXTERNAL_API_KEYS` and a `quota=` per
 * key (defaults to 60 req/h). When the env var is unset or empty,
 * the gate is *open* — useful for internal/preview deployments.
 *
 * Storage is in-process (Map). When we move to a real billing layer
 * we swap this single module for a Stripe-keyed Redis-backed store —
 * every consumer (`requireApiKey()`) keeps the same call site.
 *
 * ENV format (one key per comma-separated entry):
 *
 *   EXTERNAL_API_KEYS="key_demo:60,key_pro_acme:600,key_enterprise:6000"
 *
 * The number after the colon is the per-hour quota. Omit to use the
 * default `EXTERNAL_API_DEFAULT_QUOTA` (60).
 */

import type { NextRequest } from 'next/server';

const DEFAULT_QUOTA = Number(process.env.EXTERNAL_API_DEFAULT_QUOTA ?? 60);

interface KeyConfig {
  key: string;
  quotaPerHour: number;
}

interface KeyState {
  used: number;
  resetsAt: number;
}

const KEYS: Map<string, KeyConfig> = (() => {
  const raw = process.env.EXTERNAL_API_KEYS?.trim();
  const m = new Map<string, KeyConfig>();
  if (!raw) return m;
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const [key, quotaRaw] = trimmed.split(':');
    if (!key) continue;
    const q = Number(quotaRaw);
    m.set(key, {
      key,
      quotaPerHour: Number.isFinite(q) && q > 0 ? q : DEFAULT_QUOTA,
    });
  }
  return m;
})();

const state = new Map<string, KeyState>();

const HOUR_MS = 60 * 60 * 1000;

function snapshotKeyState(key: string, cfg: KeyConfig): KeyState {
  const now = Date.now();
  let s = state.get(key);
  if (!s || now >= s.resetsAt) {
    s = { used: 0, resetsAt: now + HOUR_MS };
    state.set(key, s);
  }
  return s;
}

export interface AuthResult {
  /** True when the request may proceed. */
  ok: boolean;
  /** Reason code if denied. */
  reason?: 'no_keys_configured_open' | 'missing' | 'invalid' | 'quota_exceeded';
  /** Echoed key id (so logs aren't anonymous). */
  keyId?: string;
  /** Quota headers we'll set on the response. */
  headers: Record<string, string>;
}

/**
 * Returns whether the request is allowed and the headers the caller
 * should set on their Response (rate-limit hints).
 *
 * Soft mode: when `EXTERNAL_API_KEYS` is unset, the gate is open and
 * we return `ok: true` with `reason: 'no_keys_configured_open'` so
 * the caller can log it.
 */
export function checkApiKey(req: NextRequest | Request): AuthResult {
  // Soft mode — no keys configured means the surface is open.
  if (KEYS.size === 0) {
    return {
      ok: true,
      reason: 'no_keys_configured_open',
      headers: {
        'X-RSG-Auth-Mode': 'open',
      },
    };
  }

  const header = req.headers.get('authorization') ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  const key = m?.[1]?.trim() ?? '';
  if (!key) {
    return { ok: false, reason: 'missing', headers: { 'X-RSG-Auth-Mode': 'enforced' } };
  }
  const cfg = KEYS.get(key);
  if (!cfg) {
    return { ok: false, reason: 'invalid', headers: { 'X-RSG-Auth-Mode': 'enforced' } };
  }

  const s = snapshotKeyState(key, cfg);
  if (s.used >= cfg.quotaPerHour) {
    return {
      ok: false,
      reason: 'quota_exceeded',
      keyId: key,
      headers: {
        'X-RSG-Auth-Mode': 'enforced',
        'X-RSG-Quota-Limit': String(cfg.quotaPerHour),
        'X-RSG-Quota-Used': String(s.used),
        'X-RSG-Quota-Reset': new Date(s.resetsAt).toISOString(),
      },
    };
  }
  s.used += 1;
  return {
    ok: true,
    keyId: key,
    headers: {
      'X-RSG-Auth-Mode': 'enforced',
      'X-RSG-Quota-Limit': String(cfg.quotaPerHour),
      'X-RSG-Quota-Used': String(s.used),
      'X-RSG-Quota-Reset': new Date(s.resetsAt).toISOString(),
    },
  };
}

/**
 * Convenience: returns a 401/429 `Response` when denied, otherwise
 * `null` so the caller can continue. Quota headers are always set.
 */
export function denyResponseFor(auth: AuthResult): Response | null {
  if (auth.ok) return null;
  const status =
    auth.reason === 'quota_exceeded'
      ? 429
      : auth.reason === 'missing'
      ? 401
      : auth.reason === 'invalid'
      ? 401
      : 401;
  return new Response(
    JSON.stringify({
      ok: false,
      error: auth.reason,
      detail:
        auth.reason === 'quota_exceeded'
          ? 'hourly quota exceeded'
          : auth.reason === 'invalid'
          ? 'unknown api key'
          : 'authorization required',
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...auth.headers,
      },
    }
  );
}

export function isAuthEnforced(): boolean {
  return KEYS.size > 0;
}

export function listConfiguredKeyIds(): string[] {
  return Array.from(KEYS.keys());
}
