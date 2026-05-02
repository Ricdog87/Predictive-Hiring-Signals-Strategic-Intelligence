import { NormalizedCompanySignal } from '../ingestion/types';
import { deduplicate } from '../normalizers/deduplication';
import { normalizeRawSignal } from './normalize';
import { sourceAdapters } from '../sources/adapters';

export async function runIngestionPipeline(): Promise<NormalizedCompanySignal[]> {
  const batches = await Promise.all(sourceAdapters.map((adapter) => adapter.fetch()));
  const normalized = batches.flat().map(normalizeRawSignal);
  return deduplicate(normalized);
}
