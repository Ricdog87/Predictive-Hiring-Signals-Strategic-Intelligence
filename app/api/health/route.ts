export const revalidate = 30;

export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
