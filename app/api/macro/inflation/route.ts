import { fetchDEInflation } from '../../../../lib/macroSources';

export const runtime = 'nodejs';
export const revalidate = 21_600;

export async function GET() {
  const r = await fetchDEInflation();
  return Response.json(
    r.ok
      ? { ok: true, ...r.data, generatedAt: new Date().toISOString() }
      : { ok: false, reason: r.reason, detail: r.detail, generatedAt: new Date().toISOString() }
  );
}
