import { SignalAdapter } from '../types';
import { CompanySignal } from '../../lib/types';

export const hermesAdapter: SignalAdapter = {
  provider: 'hermes',
  normalize(payload: unknown): CompanySignal[] {
    if (!Array.isArray(payload)) return [];
    return payload.map((item, idx) => ({
      id: `hermes_${idx}`,
      companyId: String((item as Record<string, unknown>).companyId ?? ''),
      provider: 'hermes',
      signalType: 'job_spike',
      impact: Number((item as Record<string, unknown>).score ?? 0),
      confidence: 0.8,
      observedAt: new Date().toISOString(),
    }));
  },
};
