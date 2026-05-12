/**
 * GET /api/admin/topup
 *
 * 302 redirect to the upstream provider's credit-management portal. The
 * Engine Status modal links here so the customer-facing HTML never
 * contains a vendor hostname. The target URL itself is public — the
 * redirect's only job is to keep the vendor name out of the bundle —
 * so we don't bother gating it behind ADMIN_TOKEN.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_PORTAL_URL = 'https://openrouter.ai/settings/credits';

export async function GET(): Promise<Response> {
  return Response.redirect(PROVIDER_PORTAL_URL, 302);
}
