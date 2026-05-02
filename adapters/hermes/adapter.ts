import { SignalAdapter } from '../types';
import { CandidateSignal } from '../../lib/types';

export const hermesAdapter: SignalAdapter = {
  provider: 'hermes',
  normalize(payload: unknown): CandidateSignal[] {
    if (!Array.isArray(payload)) return [];
    return payload.map((item, idx) => ({
      id: `hermes_${idx}`,
      candidateId: String((item as Record<string, unknown>).candidateId ?? ''),
      provider: 'hermes',
      signalType: 'skills',
      value: Number((item as Record<string, unknown>).score ?? 0),
      confidence: 0.8,
      observedAt: new Date().toISOString(),
    }));
  },
};
