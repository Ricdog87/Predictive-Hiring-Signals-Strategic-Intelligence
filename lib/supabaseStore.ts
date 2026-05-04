/**
 * Supabase persistence · v1.
 *
 * Talks to Supabase over its PostgREST surface — no `@supabase/supabase-js`
 * dependency. Three tables, all created by `supabase/migrations/0001_init.sql`:
 *
 *   ingest_signals       — every accepted /api/ingest signal
 *   news_items           — classified RSS news items (history)
 *   intel_snapshots      — daily snapshot archives (for SaaS history view)
 *
 * Activates only when both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
 * are set on the radar. Without them, every call short-circuits and the
 * caller falls back to its existing in-memory / KV path. The radar never
 * breaks because Supabase is missing.
 */

import type { IngestRecord } from './ingestStore';

const TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS ?? 6_000);

function baseUrl(): string | null {
  const raw = process.env.SUPABASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

function serviceKey(): string | null {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function isSupabaseConfigured(): boolean {
  return baseUrl() !== null && serviceKey() !== null;
}

interface RestRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** Postgrest preference header — `return=representation` to get back the row. */
  prefer?: string;
}

async function rest<T>(req: RestRequest): Promise<
  | { ok: true; data: T }
  | { ok: false; reason: 'unconfigured' | 'timeout' | 'http_error' | 'network' | 'parse_error'; detail?: string; status?: number }
> {
  const root = baseUrl();
  const key = serviceKey();
  if (!root || !key) {
    return { ok: false, reason: 'unconfigured' };
  }
  const url = `${root}${req.path.startsWith('/') ? '' : '/'}${req.path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (req.prefer) headers.Prefer = req.prefer;
    const res = await fetch(url, {
      method: req.method,
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        reason: 'http_error',
        status: res.status,
        detail: text.slice(0, 300),
      };
    }
    if (res.status === 204) {
      return { ok: true, data: [] as unknown as T };
    }
    try {
      return { ok: true, data: (await res.json()) as T };
    } catch (err) {
      return { ok: false, reason: 'parse_error', detail: (err as Error).message };
    }
  } catch (err) {
    const message = (err as Error).message ?? 'unknown';
    return {
      ok: false,
      reason: message.includes('aborted') ? 'timeout' : 'network',
      detail: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------------------
// ingest_signals
// -----------------------------------------------------------------------------

interface IngestRow extends IngestRecord {
  /** ISO-8601 timestamp the row was inserted. */
  inserted_at?: string;
}

/**
 * Idempotent upsert: on conflict on `id` (deterministic hash from the
 * source / company / type / observedAt / title), update the row in
 * place. PostgREST `Prefer: resolution=merge-duplicates` does this in
 * one round-trip without needing a stored procedure.
 */
export async function persistIngestRecord(
  record: IngestRecord
): Promise<{ ok: true } | { ok: false; reason: string; detail?: string }> {
  const r = await rest<IngestRow[]>({
    method: 'POST',
    path: '/rest/v1/ingest_signals',
    body: [record],
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail };
  return { ok: true };
}

export async function listPersistedIngest(limit = 200): Promise<
  { ok: true; data: IngestRecord[] } | { ok: false; reason: string }
> {
  const cap = Math.max(1, Math.min(2000, limit));
  const r = await rest<IngestRecord[]>({
    method: 'GET',
    path: `/rest/v1/ingest_signals?select=*&order=received_at.desc&limit=${cap}`,
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  // Postgres column names may be snake_case; normalise to the in-memory
  // record shape used by the rest of the app.
  const normalised = (r.data ?? []).map((row) =>
    normaliseRow(row as unknown as Record<string, unknown>)
  );
  return { ok: true, data: normalised };
}

function normaliseRow(row: Record<string, unknown>): IngestRecord {
  // Accept both camelCase (matches IngestRecord) and snake_case fields.
  const get = (camel: string, snake: string): unknown =>
    row[camel] ?? row[snake];
  return {
    id: String(get('id', 'id') ?? ''),
    companyName: String(get('companyName', 'company_name') ?? ''),
    signalType: get('signalType', 'signal_type') as IngestRecord['signalType'],
    source: String(get('source', 'source') ?? ''),
    title: String(get('title', 'title') ?? ''),
    description: String(get('description', 'description') ?? ''),
    impact: Number(get('impact', 'impact') ?? 0),
    confidence: Number(get('confidence', 'confidence') ?? 0),
    observedAt: String(get('observedAt', 'observed_at') ?? ''),
    receivedAt: String(get('receivedAt', 'received_at') ?? ''),
    metadata:
      (get('metadata', 'metadata') as Record<string, unknown>) ?? {},
  };
}

// -----------------------------------------------------------------------------
// intel_snapshots — daily archive of /api/intel/snapshot for history /
// time-series sparklines once the dashboard wires them in.
// -----------------------------------------------------------------------------

export interface PersistedSnapshot {
  id?: string;
  generated_at: string;
  payload: unknown;
}

export async function persistSnapshot(
  payload: unknown
): Promise<{ ok: true } | { ok: false; reason: string; detail?: string }> {
  const row: PersistedSnapshot = {
    generated_at: new Date().toISOString(),
    payload,
  };
  const r = await rest<unknown>({
    method: 'POST',
    path: '/rest/v1/intel_snapshots',
    body: [row],
    prefer: 'return=minimal',
  });
  if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail };
  return { ok: true };
}

export async function listSnapshots(limit = 30): Promise<
  | { ok: true; data: Array<{ generated_at: string; payload: unknown }> }
  | { ok: false; reason: string }
> {
  const cap = Math.max(1, Math.min(365, limit));
  const r = await rest<Array<{ generated_at: string; payload: unknown }>>({
    method: 'GET',
    path: `/rest/v1/intel_snapshots?select=generated_at,payload&order=generated_at.desc&limit=${cap}`,
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, data: r.data ?? [] };
}

// -----------------------------------------------------------------------------
// news_items — historical archive of classified wire-feed items
// -----------------------------------------------------------------------------

export interface PersistedNewsItem {
  link: string;
  title: string;
  source: string;
  source_label: string;
  trust: number;
  signal_type: string;
  impact: number;
  confidence: number;
  entity_canonical: string;
  entity_sector: string | null;
  entity_region: string | null;
  published_at: string;
  classified_at: string;
  breaking: boolean;
}

export async function persistNewsItems(
  items: PersistedNewsItem[]
): Promise<{ ok: true; count: number } | { ok: false; reason: string; detail?: string }> {
  if (items.length === 0) return { ok: true, count: 0 };
  const r = await rest<unknown>({
    method: 'POST',
    path: '/rest/v1/news_items',
    body: items,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail };
  return { ok: true, count: items.length };
}

/**
 * Lightweight ping for /api/health — exercises the GET path so we know
 * read auth + the base URL are wired up correctly. Returns latency.
 */
export async function pingSupabase(): Promise<
  | { ok: true; latencyMs: number }
  | { ok: false; reason: string; detail?: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: 'unconfigured' };
  }
  const t0 = Date.now();
  // count=exact returns just the row count without the rows themselves.
  const r = await rest<unknown>({
    method: 'GET',
    path: '/rest/v1/ingest_signals?select=id&limit=1',
  });
  if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail };
  return { ok: true, latencyMs: Date.now() - t0 };
}
