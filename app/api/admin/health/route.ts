import { NextRequest } from 'next/server';
import { checkAdmin, denyAdmin, isAdminBootstrapped } from '../../../../lib/adminAuth';
import { isSupabaseConfigured } from '../../../../lib/supabaseStore';
import { RUNTIME_CONFIG_INFO } from '../../../../lib/runtimeConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Pre-auth status probe — used by the /admin/settings page on first
 * load so it can show "ADMIN_TOKEN missing — set it in Vercel" before
 * asking the user for a token. Returns minimal info.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const wantAuthCheck = url.searchParams.get('verify') === '1';

  // /api/admin/health (no verify) returns the bootstrap state — no auth.
  if (!wantAuthCheck) {
    return Response.json({
      ok: true,
      adminBootstrapped: isAdminBootstrapped(),
      supabaseConfigured: isSupabaseConfigured(),
      runtimeConfigSupabaseConfigured: RUNTIME_CONFIG_INFO.supabaseConfigured(),
      runtimeConfigTtlMs: RUNTIME_CONFIG_INFO.ttlMs,
      generatedAt: new Date().toISOString(),
    });
  }

  // /api/admin/health?verify=1 — this validates a token (used by the UI
  // when the user pastes a token to confirm correctness before
  // unlocking the form).
  const auth = checkAdmin(req);
  const denied = denyAdmin(auth);
  if (denied) return denied;

  return Response.json({
    ok: true,
    verified: true,
    adminBootstrapped: true,
    supabaseConfigured: isSupabaseConfigured(),
    generatedAt: new Date().toISOString(),
  });
}
