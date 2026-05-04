import { NextRequest } from 'next/server';
import {
  appendIngest,
  isIngestStoreUsingKv,
  listIngest,
  normalizeSignalType,
  VALID_SIGNAL_TYPES,
} from '../../../lib/ingestStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BATCH = 100;
const TOKEN = process.env.INGEST_TOKEN?.trim();

interface RawPayload {
  companyName?: unknown;
  signalType?: unknown;
  source?: unknown;
  title?: unknown;
  description?: unknown;
  impact?: unknown;
  confidence?: unknown;
  observedAt?: unknown;
  metadata?: unknown;
}

interface ValidationResult {
  ok: boolean;
  errors: string[];
  record?: Parameters<typeof appendIngest>[0];
}

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function asNumber(v: unknown, fallback = NaN): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function asMetadata(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function validate(p: RawPayload): ValidationResult {
  const errors: string[] = [];

  const companyName = asString(p.companyName).trim();
  if (!companyName) errors.push('companyName is required');

  const signalRaw = asString(p.signalType).trim();
  const signalType = normalizeSignalType(signalRaw);
  if (!signalType) {
    errors.push(
      `signalType "${signalRaw}" not recognized; expected one of: ${VALID_SIGNAL_TYPES.join(', ')}`
    );
  }

  const source = asString(p.source).trim() || 'external';
  const title = asString(p.title).trim() || `${companyName} · ${signalRaw || 'signal'}`;
  const description = asString(p.description).trim();

  const impactRaw = asNumber(p.impact, 0);
  const impact = clamp(Math.round(impactRaw), -100, 100);

  const confidenceRaw = asNumber(p.confidence, 0.5);
  const confidence = clamp(
    confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw,
    0,
    1
  );

  const observedRaw = asString(p.observedAt).trim();
  const observedDate = observedRaw ? new Date(observedRaw) : new Date();
  const observedAt = Number.isNaN(observedDate.getTime())
    ? new Date().toISOString()
    : observedDate.toISOString();

  const metadata = asMetadata(p.metadata);

  if (errors.length || !signalType) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    record: {
      companyName,
      signalType,
      source,
      title,
      description,
      impact,
      confidence,
      observedAt,
      metadata,
    },
  };
}

function authorized(req: NextRequest): boolean {
  if (!TOKEN) return true; // open ingest if no token configured
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return !!match && match[1].trim() === TOKEN;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: 'invalid JSON body' },
      { status: 400 }
    );
  }

  const items: RawPayload[] = Array.isArray(body)
    ? (body as RawPayload[])
    : [body as RawPayload];

  if (items.length === 0) {
    return Response.json(
      { ok: false, error: 'empty payload' },
      { status: 400 }
    );
  }
  if (items.length > MAX_BATCH) {
    return Response.json(
      { ok: false, error: `batch too large (max ${MAX_BATCH})` },
      { status: 413 }
    );
  }

  const accepted: unknown[] = [];
  const rejected: { index: number; errors: string[] }[] = [];

  for (let i = 0; i < items.length; i++) {
    const v = validate(items[i] ?? {});
    if (!v.ok || !v.record) {
      rejected.push({ index: i, errors: v.errors });
      continue;
    }
    try {
      const stored = await appendIngest(v.record);
      accepted.push({
        id: stored.id,
        signalType: stored.signalType,
        companyName: stored.companyName,
        impact: stored.impact,
        confidence: stored.confidence,
        observedAt: stored.observedAt,
      });
    } catch (err) {
      rejected.push({
        index: i,
        errors: [(err as Error).message ?? 'storage error'],
      });
    }
  }

  const status = accepted.length === 0 ? 422 : 200;
  return Response.json(
    {
      ok: accepted.length > 0,
      accepted: accepted.length,
      rejected: rejected.length,
      results: { accepted, rejected },
      store: isIngestStoreUsingKv() ? 'kv' : 'memory',
      generatedAt: new Date().toISOString(),
    },
    { status }
  );
}

export async function GET() {
  const records = await listIngest(50);
  return Response.json({
    data: records,
    count: records.length,
    store: isIngestStoreUsingKv() ? 'kv' : 'memory',
    generatedAt: new Date().toISOString(),
  });
}
