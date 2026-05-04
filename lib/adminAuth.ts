/**
 * Admin gate · v1.
 *
 * Bearer-only auth for `/api/admin/*` routes. The token is set ONCE
 * via `ADMIN_TOKEN` env on Vercel — this is the single bootstrap
 * secret that gates the in-dashboard /admin/settings page.
 *
 * The /admin/settings page asks the user for the token on first load,
 * stores it in localStorage, and sends it as `Authorization: Bearer
 * <token>` on every config write.
 *
 * If `ADMIN_TOKEN` is not set, /api/admin/* surfaces are LOCKED — the
 * settings page renders a "configure ADMIN_TOKEN to unlock" message.
 * (Better than open admin in production.)
 */

import type { NextRequest } from 'next/server';

export interface AdminAuthResult {
  ok: boolean;
  reason?: 'bootstrap_missing' | 'missing' | 'invalid';
}

export function checkAdmin(req: NextRequest | Request): AdminAuthResult {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) {
    return { ok: false, reason: 'bootstrap_missing' };
  }
  const header = req.headers.get('authorization') ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, reason: 'missing' };
  if (m[1].trim() !== expected) return { ok: false, reason: 'invalid' };
  return { ok: true };
}

export function denyAdmin(auth: AdminAuthResult): Response | null {
  if (auth.ok) return null;
  const status =
    auth.reason === 'bootstrap_missing'
      ? 503
      : auth.reason === 'missing'
      ? 401
      : 401;
  return new Response(
    JSON.stringify({
      ok: false,
      error: auth.reason,
      detail:
        auth.reason === 'bootstrap_missing'
          ? 'ADMIN_TOKEN is not configured on this deployment. Set it in the Vercel env once to unlock the in-dashboard settings.'
          : auth.reason === 'invalid'
          ? 'invalid admin token'
          : 'admin token required',
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export function isAdminBootstrapped(): boolean {
  return !!process.env.ADMIN_TOKEN?.trim();
}
