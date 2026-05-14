/**
 * GET /api/voice/greeting?name=Ricardo
 *
 * Returns a cinematic MP3 greeting for the given user name. Three-layer
 * cache so the upstream TTS provider is hit at most once per
 * (name × time-bucket × voice × model):
 *
 *   1. In-memory LRU (warm-lambda, ~30 entries, <2 MB) — survives a
 *      few seconds across requests.
 *   2. Disk cache at /tmp/voice-cache/<key>.mp3 — persists across
 *      requests within a Vercel lambda instance lifetime (5-15 min).
 *   3. Upstream HTTP call → lib/voiceGreeting.ts :: generateGreetingAudio.
 *
 * Cost guard: 10 generations / day / name (sliding window, in-memory).
 * Cache reads do NOT consume quota — only upstream calls.
 *
 * Whitelabel: customer-facing strings refer to this as "audio welcome"
 * or "voice greeting". The vendor name lives only in env vars / log
 * lines / lib JSDoc.
 */

import { NextRequest } from 'next/server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  cacheKeyFor,
  generateGreetingAudio,
  isVoiceGreetingConfigured,
  sanitiseName,
} from '@/lib/voiceGreeting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CACHE_DIR = '/tmp/voice-cache';
const CACHE_MAX_AGE_S = 3600; // 1h public CDN/browser cache
const LRU_MAX = 30;
const QUOTA_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// In-memory LRU
// ---------------------------------------------------------------------------

interface LruEntry {
  buf: Buffer;
  ts: number;
}
const globalForCache = globalThis as unknown as {
  __rsgVoiceLru?: Map<string, LruEntry>;
  __rsgVoiceQuota?: Map<string, number[]>;
};

function lru(): Map<string, LruEntry> {
  if (!globalForCache.__rsgVoiceLru) {
    globalForCache.__rsgVoiceLru = new Map();
  }
  return globalForCache.__rsgVoiceLru;
}

function lruGet(key: string): Buffer | null {
  const m = lru();
  const hit = m.get(key);
  if (!hit) return null;
  // Refresh recency.
  m.delete(key);
  m.set(key, hit);
  return hit.buf;
}

function lruSet(key: string, buf: Buffer): void {
  const m = lru();
  m.set(key, { buf, ts: Date.now() });
  while (m.size > LRU_MAX) {
    const oldest = m.keys().next().value;
    if (oldest == null) break;
    m.delete(oldest);
  }
}

// ---------------------------------------------------------------------------
// Quota
// ---------------------------------------------------------------------------

function quota(): Map<string, number[]> {
  if (!globalForCache.__rsgVoiceQuota) {
    globalForCache.__rsgVoiceQuota = new Map();
  }
  return globalForCache.__rsgVoiceQuota;
}

function consumeQuota(name: string): { ok: boolean; remaining: number } {
  const key = sanitiseName(name).toLowerCase();
  const q = quota();
  const now = Date.now();
  const cutoff = now - DAY_MS;
  const hits = (q.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= QUOTA_PER_DAY) {
    q.set(key, hits);
    return { ok: false, remaining: 0 };
  }
  hits.push(now);
  q.set(key, hits);
  return { ok: true, remaining: QUOTA_PER_DAY - hits.length };
}

// ---------------------------------------------------------------------------
// Disk cache
// ---------------------------------------------------------------------------

function diskPath(key: string): string {
  // /tmp is the only writable location on Vercel.
  return path.join(CACHE_DIR, `${key}.mp3`);
}

async function readDisk(key: string): Promise<Buffer | null> {
  try {
    return await readFile(diskPath(key));
  } catch {
    return null;
  }
}

async function writeDisk(key: string, buf: Buffer): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(diskPath(key), buf);
  } catch {
    // disk-full / EACCES on a misconfigured host — non-fatal, the LRU
    // still has the entry.
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

function mp3Response(buf: Buffer, headers: Record<string, string> = {}): Response {
  // Build a fresh ArrayBuffer view so the runtime doesn't choke on
  // Buffer/Uint8Array variance across Next versions.
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return new Response(ab, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(buf.byteLength),
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE_S}, s-maxage=${CACHE_MAX_AGE_S}`,
      ...headers,
    },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const rawName = url.searchParams.get('name') ?? '';
  const name = sanitiseName(rawName);

  if (!isVoiceGreetingConfigured()) {
    return Response.json(
      { ok: false, reason: 'unconfigured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const key = cacheKeyFor(name);

  // 1. LRU
  const fromLru = lruGet(key);
  if (fromLru) {
    return mp3Response(fromLru, { 'X-Voice-Cache': 'lru' });
  }

  // 2. Disk
  const fromDisk = await readDisk(key);
  if (fromDisk) {
    lruSet(key, fromDisk);
    return mp3Response(fromDisk, { 'X-Voice-Cache': 'disk' });
  }

  // 3. Quota check (only counted before an upstream call)
  const q = consumeQuota(name);
  if (!q.ok) {
    console.warn(
      `[voice] quota exceeded for "${name}" — silent fail (10/day cap)`,
    );
    return Response.json(
      { ok: false, reason: 'quota' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // 4. Upstream
  const gen = await generateGreetingAudio(name);
  if (!gen.ok) {
    const status =
      gen.reason === 'timeout'
        ? 504
        : gen.reason === 'unconfigured'
        ? 503
        : 502;
    return Response.json(
      { ok: false, reason: gen.reason },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  lruSet(key, gen.mp3);
  await writeDisk(key, gen.mp3);

  return mp3Response(gen.mp3, {
    'X-Voice-Cache': 'miss',
    'X-Voice-Generated-Ms': String(gen.ms),
  });
}
