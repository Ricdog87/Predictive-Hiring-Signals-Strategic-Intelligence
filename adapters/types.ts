import { CompanySignal } from '../lib/types';

export interface SignalAdapter {
  provider: 'hermes' | 'n8n' | 'mirofish';
  normalize(payload: unknown): CompanySignal[];
}
