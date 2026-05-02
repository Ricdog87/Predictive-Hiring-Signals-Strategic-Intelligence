import { SignalAdapter } from '../types';
import { CandidateSignal } from '../../lib/types';

export const mirofishAdapter: SignalAdapter = {
  provider: 'mirofish',
  normalize(payload: unknown): CandidateSignal[] {
    if (!Array.isArray(payload)) return [];
    return payload.map((item, idx) => ({
      id: `mirofish_${idx}`,
      candidateId: String((item as Record<string, unknown>).id ?? ''),
      provider: 'mirofish',
      signalType: 'culture',
      value: Number((item as Record<string, unknown>).culture ?? 0),
      confidence: 0.7,
      observedAt: new Date().toISOString(),
    }));
  },
};
