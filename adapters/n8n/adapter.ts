import { SignalAdapter } from '../types';
import { CompanySignal } from '../../lib/types';

export const n8nAdapter: SignalAdapter = {
  provider: 'n8n',
  normalize(payload: unknown): CompanySignal[] {
    if (!Array.isArray(payload)) return [];
    return payload.map((item, idx) => ({
      id: `n8n_${idx}`,
      companyId: String((item as Record<string, unknown>).companyId ?? ''),
      provider: 'n8n',
      signalType: 'employee_growth',
      impact: Number((item as Record<string, unknown>).impact ?? 0),
      confidence: 0.75,
      observedAt: new Date().toISOString(),
    }));
  },
};
