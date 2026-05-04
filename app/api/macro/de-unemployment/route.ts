import { fetchDEUnemployment } from '../../../../lib/macro';

export const runtime = 'nodejs';
export const revalidate = 21_600; // 6h

export async function GET() {
  const r = await fetchDEUnemployment();
  if (!r.ok) {
    return Response.json(
      {
        ok: false,
        reason: r.reason,
        detail: r.detail,
        generatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
  return Response.json({
    ok: true,
    ...r.data,
    generatedAt: new Date().toISOString(),
  });
}
