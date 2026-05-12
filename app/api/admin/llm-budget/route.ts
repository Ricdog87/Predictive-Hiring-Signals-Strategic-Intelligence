/**
 * GET /api/admin/llm-budget
 *
 * Admin-only. Returns a budget snapshot for the Forecast Engine so the
 * footer widget can warn the operator before a live demo runs the key
 * empty. Whitelabel: all strings are scrubbed before they leave
 * `lib/llmBudget.ts`.
 */

import { NextRequest } from 'next/server';
import { checkAdmin, denyAdmin } from '@/lib/adminAuth';
import { fetchEngineBudget, isBudgetConfigured } from '@/lib/llmBudget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = checkAdmin(req);
  const deny = denyAdmin(auth);
  if (deny) return deny;

  if (!isBudgetConfigured()) {
    return Response.json(
      { ok: false, reason: 'unconfigured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await fetchEngineBudget();
  if (!result.ok) {
    const status =
      result.reason === 'timeout'
        ? 504
        : result.reason === 'unconfigured'
        ? 503
        : 502;
    return Response.json(
      { ok: false, reason: result.reason, detail: result.detail },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return Response.json(
    { ok: true, data: result.data },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    },
  );
}
