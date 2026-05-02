import { computeCandidateScore } from '../../../lib/scoring';
import { signals } from '../../../lib/mockData';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const candidateId = url.searchParams.get('candidateId');

  if (!candidateId) {
    return Response.json({ error: 'candidateId query param is required' }, { status: 400 });
  }

  const input = signals.filter((signal) => signal.candidateId === candidateId);
  const result = computeCandidateScore(candidateId, input);

  return Response.json({ data: result, generatedAt: new Date().toISOString() });
}
