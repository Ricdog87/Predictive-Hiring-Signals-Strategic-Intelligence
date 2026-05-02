import { NormalizedCompanySignal } from '../ingestion/types';

export function deduplicate(signals: NormalizedCompanySignal[]): NormalizedCompanySignal[] {
  const byKey = new Map<string, NormalizedCompanySignal>();
  for (const signal of signals) {
    const day = signal.detectedAt.slice(0, 10);
    const key = `${signal.companyId}|${signal.signalType}|${signal.title.toLowerCase()}|${day}`;
    const existing = byKey.get(key);
    if (!existing || signal.confidence > existing.confidence) {
      byKey.set(key, signal);
    }
  }
  return [...byKey.values()];
}
