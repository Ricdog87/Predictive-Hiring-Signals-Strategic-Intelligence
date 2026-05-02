import { SignalAdapter } from '../types';
import { CandidateSignal } from '../../lib/types';

export const n8nAdapter: SignalAdapter = {
  provider: 'n8n',
  normalize(payload: unknown): CandidateSignal[] {
    if (!Array.isArray(payload)) return [];
    return payload.map((item, idx) => ({
      id: `n8n_${idx}`,
      candidateId: String((item as Record<string, unknown>).candidate ?? ''),
      provider: 'n8n',
      signalType: 'engagement',
      value: Number((item as Record<string, unknown>).engagement ?? 0),
      confidence: 0.75,
      observedAt: new Date().toISOString(),
    }));
  },
};
