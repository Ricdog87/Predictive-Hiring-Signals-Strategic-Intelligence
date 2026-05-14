/**
 * lib/voiceGreeting.ts
 *
 * Server-side adapter for the cinematic dashboard greeting. Uses the
 * ElevenLabs Text-to-Speech HTTP API and returns the raw MP3 buffer so
 * the route handler can cache it to disk and stream it back.
 *
 * Whitelabel: this file is server-only. The vendor name only appears
 * in JSDoc, env-var names and internal log lines — the customer-facing
 * UI never reads it.
 *
 * Cost guard
 *   - Hard token cap on the generated text (templates are 80-160 chars).
 *   - Sliding-window in-memory quota in the route handler (10/day per
 *     name) catches runaway loops before they reach the upstream.
 *   - Disk + LRU cache fronts every call.
 *
 * Failure mode
 *   - `unconfigured` when API key is missing → 503 in the route, UI
 *     silently disables the greeter (no toast, no console spam).
 *   - `timeout`, `upstream`, `network` mapped to discriminated unions
 *     so the route can pick HTTP statuses.
 */

const DEFAULT_VOICE_ID = 'nPczCjzI2devNBz1zQrb'; // "Brian"
const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5';
const DEFAULT_TIMEOUT_MS = 15_000;
const ENDPOINT_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type TimeBucket = 'morning' | 'midday' | 'evening' | 'night';

interface Template {
  text: (name: string) => string;
  buckets?: ReadonlySet<TimeBucket>;
}

/**
 * Cinematic greeting variants. JARVIS / FRIDAY tonality — calm,
 * declarative, slightly dramatic.  Selection is deterministic per
 * (name, bucket) so two reloads inside the same time window yield the
 * same cached MP3.
 */
const TEMPLATES: readonly Template[] = [
  {
    text: (n) =>
      `Welcome back, ${n}. Predictive Hiring Radar online. Standing by.`,
  },
  {
    text: (n) => `Good to see you, ${n}. All systems operational.`,
  },
  {
    text: (n) =>
      `Welcome, ${n}. Hiring intelligence streaming. Markets are tracking.`,
  },
  {
    text: (n) => `Online, ${n}. Pipeline is warm. Let us get to work.`,
  },
  {
    text: (n) =>
      `Good morning, ${n}. Engine spun up. New signals arriving.`,
    buckets: new Set<TimeBucket>(['morning']),
  },
  {
    text: (n) => `Good evening, ${n}. Markets are quieting. Brief is ready.`,
    buckets: new Set<TimeBucket>(['evening', 'night']),
  },
];

export function timeBucket(date: Date = new Date()): TimeBucket {
  const h = date.getHours();
  if (h < 11) return 'morning';
  if (h < 14) return 'midday';
  if (h < 21) return 'evening';
  return 'night';
}

/**
 * Pick a template deterministically per (name, bucket). FNV-1a over the
 * key keeps things stable across processes and avoids importing a hash
 * library.
 */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

export function pickGreeting(name: string, bucket: TimeBucket): string {
  const eligible = TEMPLATES.filter((t) => !t.buckets || t.buckets.has(bucket));
  const pool = eligible.length > 0 ? eligible : TEMPLATES;
  const idx = fnv1a(`${name.toLowerCase()}|${bucket}`) % pool.length;
  const safeName = sanitiseName(name);
  return pool[idx].text(safeName);
}

/**
 * Cinematic-speech sanity guard: strip control chars + SSML-ish markup
 * + tighten whitespace. We never trust the user-supplied display name
 * literally — even though it's our own field, it could carry punctuation
 * that derails the TTS engine.
 */
export function sanitiseName(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 'there';
  return trimmed
    .replace(/[<>\\/{}|`]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 48);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface VoiceConfig {
  apiKey: string;
  voiceId: string;
  modelId: string;
  timeoutMs: number;
  stability: number;
  similarityBoost: number;
  style: number;
}

function readConfig(): VoiceConfig {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() ?? '',
    voiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID,
    modelId: process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID,
    timeoutMs:
      Number(process.env.ELEVENLABS_TIMEOUT_MS) > 0
        ? Number(process.env.ELEVENLABS_TIMEOUT_MS)
        : DEFAULT_TIMEOUT_MS,
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.4,
  };
}

export function isVoiceGreetingConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type GenerateFailure =
  | { ok: false; reason: 'unconfigured' }
  | { ok: false; reason: 'timeout' }
  | { ok: false; reason: 'upstream'; status: number; detail?: string }
  | { ok: false; reason: 'network'; detail?: string };

export type GenerateResult =
  | { ok: true; mp3: Buffer; text: string; voiceId: string; ms: number }
  | GenerateFailure;

/**
 * Generate a one-shot greeting MP3 for `name`. Caller is responsible
 * for caching the result — this function always hits the upstream.
 */
export async function generateGreetingAudio(
  name: string,
  opts: { now?: Date } = {},
): Promise<GenerateResult> {
  const cfg = readConfig();
  if (!cfg.apiKey) return { ok: false, reason: 'unconfigured' };

  const bucket = timeBucket(opts.now);
  const text = pickGreeting(name, bucket);

  const controller = new AbortController();
  const tmo = setTimeout(() => controller.abort(), cfg.timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(`${ENDPOINT_BASE}/${cfg.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': cfg.apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: cfg.modelId,
        voice_settings: {
          stability: cfg.stability,
          similarity_boost: cfg.similarityBoost,
          style: cfg.style,
          use_speaker_boost: true,
        },
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return {
        ok: false,
        reason: 'upstream',
        status: res.status,
        detail: detail.slice(0, 200),
      };
    }

    const ab = await res.arrayBuffer();
    return {
      ok: true,
      mp3: Buffer.from(ab),
      text,
      voiceId: cfg.voiceId,
      ms: Date.now() - t0,
    };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e?.name === 'AbortError') return { ok: false, reason: 'timeout' };
    return { ok: false, reason: 'network', detail: e?.message };
  } finally {
    clearTimeout(tmo);
  }
}

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

/**
 * Stable cache key per (name, bucket, voice, model). Pure function so
 * the route's filesystem layer can compute the path without touching
 * the upstream.
 */
export function cacheKeyFor(name: string, opts: { now?: Date } = {}): string {
  const cfg = readConfig();
  const bucket = timeBucket(opts.now);
  return `${sanitiseName(name).toLowerCase()}_${bucket}_${cfg.voiceId}_${cfg.modelId}`;
}
