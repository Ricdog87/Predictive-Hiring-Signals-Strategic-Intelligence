import { RawSignal } from '../ingestion/types';

export function parseFeedRows(source: string, rows: Array<Record<string, unknown>>): RawSignal[] {
  return rows.map((row, idx) => ({
    source,
    externalId: String(row.id ?? `${source}_${idx}`),
    companyName: String(row.companyName ?? row.company ?? 'unknown company'),
    publishedAt: String(row.publishedAt ?? new Date().toISOString()),
    title: String(row.title ?? 'untitled'),
    description: String(row.description ?? ''),
    payload: row,
  }));
}
