/**
 * Live ingest store.
 *
 * Stores hiring signals POSTed to /api/ingest from external pipelines
 * (n8n, custom workers, manual curl). Persists to Vercel KV / Upstash
 * Redis when `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set, falls back
 * to a process-local in-memory ring buffer otherwise — sufficient for
 * preview deployments and local dev, but multi-instance fan-out requires
 * the KV path.
 */

import type { CompanySignal, HiringSignalType } from './types';

export const VALID_SIGNAL_TYPES: HiringSignalType[] = [
  'mna_buy',
  'mna_sell',
  'gf_change',
  'patent_filing',
  'location_expansion',
  'funding_grant',
  'press_release',
  'restructuring',
  'insolvency',
  'job_spike',
  'employee_growth',
  'product_launch',
  'new_business_unit',
];

const SIGNAL_TYPE_ALIASES: Record<string, HiringSignalType> = {
  expansion: 'location_expansion',
  location_expansion: 'location_expansion',
  funding: 'funding_grant',
  funding_grant: 'funding_grant',
  grant: 'funding_grant',
  patent: 'patent_filing',
  patent_filing: 'patent_filing',
  job_spike: 'job_spike',
  hiring_spike: 'job_spike',
  jobs: 'job_spike',
  employee_growth: 'employee_growth',
  hc_growth: 'employee_growth',
  product_launch: 'product_launch',
  launch: 'product_launch',
  new_business_unit: 'new_business_unit',
  new_bu: 'new_business_unit',
  press_release: 'press_release',
  press: 'press_release',
  pr: 'press_release',
  restructuring: 'restructuring',
  insolvency: 'insolvency',
  mna_buy: 'mna_buy',
  acquisition: 'mna_buy',
  mna_sell: 'mna_sell',
  divestiture: 'mna_sell',
  gf_change: 'gf_change',
  leadership_change: 'gf_change',
};

export function normalizeSignalType(raw: string): HiringSignalType | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return SIGNAL_TYPE_ALIASES[k] ?? null;
}

export interface IngestRecord {
  id: string;
  companyName: string;
  signalType: HiringSignalType;
  source: string;
  title: string;
  description: string;
  impact: number;
  confidence: number;
  observedAt: string;
  receivedAt: string;
  metadata: Record<string, unknown>;
}

const MAX_RECORDS = 5000;
const KV_KEY = 'rsg:ingest:records:v1';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const useKv = Boolean(KV_URL && KV_TOKEN);

interface MemoryStore {
  records: IngestRecord[];
}

const globalForStore = globalThis as unknown as {
  __rsgIngestStore?: MemoryStore;
};

const memory: MemoryStore =
  globalForStore.__rsgIngestStore ?? { records: [] };
globalForStore.__rsgIngestStore = memory;

async function kvCmd<T = unknown>(...args: (string | number)[]): Promise<T> {
  if (!useKv) throw new Error('KV not configured');
  const res = await fetch(KV_URL!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`KV ${args[0]} failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { result: T };
  return body.result;
}

function buildId(record: Omit<IngestRecord, 'id' | 'receivedAt'>): string {
  const base = `${record.source}:${record.companyName}:${record.signalType}:${record.observedAt}:${record.title}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  }
  return `ing_${Math.abs(hash).toString(36)}`;
}

export async function appendIngest(
  input: Omit<IngestRecord, 'id' | 'receivedAt'>
): Promise<IngestRecord> {
  const record: IngestRecord = {
    ...input,
    id: buildId(input),
    receivedAt: new Date().toISOString(),
  };

  if (useKv) {
    try {
      await kvCmd('LPUSH', KV_KEY, JSON.stringify(record));
      await kvCmd('LTRIM', KV_KEY, 0, MAX_RECORDS - 1);
      return record;
    } catch (err) {
      // KV failure should not lose the signal; fall through to memory
      console.error('[ingestStore] KV append failed, using memory', err);
    }
  }

  const exists = memory.records.findIndex((r) => r.id === record.id);
  if (exists >= 0) memory.records.splice(exists, 1);
  memory.records.unshift(record);
  if (memory.records.length > MAX_RECORDS) {
    memory.records.length = MAX_RECORDS;
  }
  return record;
}

export async function listIngest(limit = 200): Promise<IngestRecord[]> {
  const cap = Math.max(1, Math.min(MAX_RECORDS, limit));
  if (useKv) {
    try {
      const raw = await kvCmd<string[]>('LRANGE', KV_KEY, 0, cap - 1);
      return (raw ?? []).map((s) => JSON.parse(s) as IngestRecord);
    } catch (err) {
      console.error('[ingestStore] KV read failed, using memory', err);
    }
  }
  return memory.records.slice(0, cap);
}

export async function clearIngest(): Promise<void> {
  if (useKv) {
    try {
      await kvCmd('DEL', KV_KEY);
    } catch (err) {
      console.error('[ingestStore] KV clear failed', err);
    }
  }
  memory.records.length = 0;
}

export function ingestRecordToSignal(rec: IngestRecord, companyId: string): CompanySignal {
  return {
    id: rec.id,
    companyId,
    provider: rec.source,
    signalType: rec.signalType,
    impact: rec.impact,
    confidence: rec.confidence,
    observedAt: rec.observedAt,
    meta: {
      companyName: rec.companyName,
      title: rec.title,
      description: rec.description,
      receivedAt: rec.receivedAt,
      ...flattenMeta(rec.metadata),
    },
  };
}

function flattenMeta(
  meta: Record<string, unknown>
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta ?? {})) {
    if (v === null) out[k] = null;
    else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else {
      out[k] = JSON.stringify(v);
    }
  }
  return out;
}

export function isIngestStoreUsingKv(): boolean {
  return useKv;
}
