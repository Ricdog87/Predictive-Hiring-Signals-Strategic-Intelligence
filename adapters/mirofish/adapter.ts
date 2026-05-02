import { SignalAdapter } from '../types';
import { CompanySignal } from '../../lib/types';

export const mirofishAdapter: SignalAdapter = {
  provider: 'mirofish',
  normalize(payload: unknown): CompanySignal[] {
    if (!Array.isArray(payload)) return [];
    return payload.map((item, idx) => ({
      id: `mirofish_${idx}`,
      companyId: String((item as Record<string, unknown>).companyId ?? ''),
      provider: 'mirofish',
      signalType: 'funding_grant',
      impact: Number((item as Record<string, unknown>).impact ?? 0),
      confidence: 0.7,
      observedAt: new Date().toISOString(),
    }));
  },
};
