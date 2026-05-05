/**
 * Runtime configuration · v1.
 *
 * Layered key/value store. Reads in this order:
 *
 *   1. In-process cache (60 s TTL, per warm lambda)
 *   2. Supabase `runtime_config` table (when SUPABASE_URL +
 *      SUPABASE_SERVICE_ROLE_KEY are set)
 *   3. `process.env[key]` as the bootstrap fallback
 *
 * The whole point: the dashboard's /admin/settings page writes to
 * Supabase, every API route reads from here, and a new value is
 * picked up on the next 60-second cache rotation — no redeploy.
 *
 * Keys that should remain pure-env (never editable in the dashboard
 * because they'd brick the system if rotated wrongly):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - ADMIN_TOKEN
 *
 * Everything else (HERMES_BASE_URL, HERMES_API_KEY, OPENROUTER model
 * overrides, ADZUNA keys, EXTERNAL_API_KEYS, …) is editable at runtime.
 */

const TTL_MS = Number(process.env.RUNTIME_CONFIG_TTL_MS ?? 60_000);

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Keys that are bootstrap-only — runtime overrides are forbidden. */
export const BOOTSTRAP_KEYS: ReadonlySet<string> = new Set([
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_TOKEN',
]);

/**
 * Keys the admin UI knows about, grouped + described. The `/admin/settings`
 * page lays itself out from this declaration — the only place to add a
 * new editable knob.
 */
export interface ConfigKeyDescriptor {
  key: string;
  category: 'engine' | 'intel' | 'jobmarket' | 'gating' | 'pipeline' | 'tuning';
  label: string;
  description: string;
  isSecret: boolean;
  /** Default placeholder shown in the form. */
  placeholder?: string;
}

export const CONFIG_KEYS: ConfigKeyDescriptor[] = [
  // --- engine layer ---
  {
    key: 'HERMES_BASE_URL',
    category: 'engine',
    label: 'RSG Engine · base URL',
    description:
      'Where the radar reaches the analysis engine (e.g. https://your-host/hermes). Leave empty to disable LLM features — dashboard will fall back gracefully.',
    isSecret: false,
    placeholder: 'https://your-host/hermes',
  },
  {
    key: 'HERMES_API_KEY',
    category: 'engine',
    label: 'RSG Engine · bearer token',
    description: 'Shared secret between this dashboard and the engine. Same value as on the engine box.',
    isSecret: true,
  },
  {
    key: 'OPENROUTER_MODEL_FAST',
    category: 'engine',
    label: 'Fast tier model',
    description:
      'Used for signal classification + company analysis. Default: openai/gpt-4o-mini. Cheap, fast.',
    isSecret: false,
    placeholder: 'openai/gpt-4o-mini',
  },
  {
    key: 'OPENROUTER_MODEL_DEEP',
    category: 'engine',
    label: 'Deep tier model',
    description: 'Used for opportunity briefs. Default: anthropic/claude-3.5-haiku.',
    isSecret: false,
    placeholder: 'anthropic/claude-3.5-haiku',
  },
  {
    key: 'OPENROUTER_MODEL_LIVE',
    category: 'engine',
    label: 'Live tier model',
    description:
      'Live web grounding — Morning Brief, Live Company Research, Regional Insights. Default: perplexity/sonar.',
    isSecret: false,
    placeholder: 'perplexity/sonar',
  },

  // --- intel / pipeline ---
  {
    key: 'INGEST_TOKEN',
    category: 'pipeline',
    label: 'Ingest bearer token',
    description: 'POST /api/ingest requires this token in the Authorization header. Used by n8n.',
    isSecret: true,
  },

  // --- job market ---
  {
    key: 'ADZUNA_APP_ID',
    category: 'jobmarket',
    label: 'Job market · App ID',
    description: 'Free dev key from developer.adzuna.com. Without this, job market panel stays empty.',
    isSecret: false,
  },
  {
    key: 'ADZUNA_APP_KEY',
    category: 'jobmarket',
    label: 'Job market · App key',
    description: 'Companion to App ID. Treat as secret.',
    isSecret: true,
  },

  // --- gating ---
  {
    key: 'EXTERNAL_API_KEYS',
    category: 'gating',
    label: 'External API keys',
    description:
      'Comma-separated `<key>:<hourlyQuota>` entries. Gates /api/intel/snapshot for SaaS subscribers. Empty = open mode.',
    isSecret: true,
    placeholder: 'demo:60,pro_acme:600',
  },
  {
    key: 'EXTERNAL_API_DEFAULT_QUOTA',
    category: 'gating',
    label: 'Default hourly quota',
    description: 'Quota when an EXTERNAL_API_KEYS entry omits its `:<quota>` suffix. Default 60.',
    isSecret: false,
    placeholder: '60',
  },

  // --- tuning ---
  {
    key: 'HERMES_RPM_LIVE',
    category: 'tuning',
    label: 'Live tier · requests/min',
    description: 'Hard rate cap for the live web tier (Morning Brief / Research). Default 4.',
    isSecret: false,
    placeholder: '4',
  },
  {
    key: 'HERMES_RPD_LIVE',
    category: 'tuning',
    label: 'Live tier · requests/day',
    description: 'Hard daily cap for the live web tier. Default 100.',
    isSecret: false,
    placeholder: '100',
  },
];

const CONFIG_KEY_SET = new Set(CONFIG_KEYS.map((k) => k.key));

function isCachable(key: string): boolean {
  return CONFIG_KEY_SET.has(key) || key.startsWith('OPENROUTER_') || key.startsWith('HERMES_');
}

// -----------------------------------------------------------------------------
// Supabase backend (lazy)
// -----------------------------------------------------------------------------

function supabaseConfigured(): boolean {
  return !!(
    process.env.SUPABASE_URL?.trim() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

async function fetchFromSupabase(key: string): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const url = `${process.env.SUPABASE_URL!.replace(/\/+$/, '')}/rest/v1/runtime_config?key=eq.${encodeURIComponent(
    key
  )}&select=value&limit=1`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ value: string }>;
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function listFromSupabase(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!supabaseConfigured()) return out;
  const url = `${process.env.SUPABASE_URL!.replace(/\/+$/, '')}/rest/v1/runtime_config?select=key,value`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return out;
    const rows = (await res.json()) as Array<{ key: string; value: string }>;
    for (const r of rows) out.set(r.key, r.value);
  } catch {
    /* noop */
  }
  return out;
}

async function upsertSupabase(
  key: string,
  value: string,
  updatedBy?: string
): Promise<{ ok: boolean; reason?: string }> {
  if (!supabaseConfigured()) {
    return { ok: false, reason: 'supabase not configured' };
  }
  const url = `${process.env.SUPABASE_URL!.replace(/\/+$/, '')}/rest/v1/runtime_config`;
  try {
    const desc = CONFIG_KEYS.find((k) => k.key === key);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([
        {
          key,
          value,
          category: desc?.category ?? 'general',
          description: desc?.description ?? null,
          is_secret: desc?.isSecret ?? true,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy ?? 'admin',
        },
      ]),
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, reason: `${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

async function deleteSupabase(key: string): Promise<{ ok: boolean }> {
  if (!supabaseConfigured()) return { ok: false };
  const url = `${process.env.SUPABASE_URL!.replace(/\/+$/, '')}/rest/v1/runtime_config?key=eq.${encodeURIComponent(
    key
  )}`;
  try {
    await fetch(url, {
      method: 'DELETE',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      cache: 'no-store',
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/** Fetch a config value. Returns the trimmed string or undefined. */
export async function getConfig(key: string): Promise<string | undefined> {
  if (!isCachable(key)) {
    const env = process.env[key]?.trim();
    return env || undefined;
  }
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value ?? undefined;
  }
  let resolved: string | null = null;
  if (!BOOTSTRAP_KEYS.has(key)) {
    resolved = await fetchFromSupabase(key);
  }
  if (!resolved) {
    const env = process.env[key]?.trim();
    resolved = env || null;
  }
  cache.set(key, { value: resolved, expiresAt: now + TTL_MS });
  return resolved ?? undefined;
}

/**
 * Synchronous variant for hot paths that already pre-loaded config.
 * Falls back to env when not in the cache. Never hits Supabase.
 */
export function getConfigSync(key: string): string | undefined {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value ?? undefined;
  }
  return process.env[key]?.trim() || undefined;
}

/** Set or update a runtime config value (admin-gated). */
export async function setConfig(
  key: string,
  value: string,
  updatedBy?: string
): Promise<{ ok: boolean; reason?: string }> {
  if (BOOTSTRAP_KEYS.has(key)) {
    return { ok: false, reason: 'bootstrap_key_locked' };
  }
  const trimmed = value.trim();
  const r = await upsertSupabase(key, trimmed, updatedBy);
  if (r.ok) {
    cache.set(key, { value: trimmed, expiresAt: Date.now() + TTL_MS });
  }
  return r;
}

/** Delete a runtime config value (admin-gated). */
export async function deleteConfig(key: string): Promise<{ ok: boolean }> {
  if (BOOTSTRAP_KEYS.has(key)) return { ok: false };
  const r = await deleteSupabase(key);
  cache.delete(key);
  return r;
}

/**
 * Snapshot of every known config knob with its current value, source
 * (supabase | env | unset) and a masked rendering for secrets.
 * Powers the /admin/settings page.
 */
export interface ConfigSnapshotEntry extends ConfigKeyDescriptor {
  value: string | null;
  /** Masked version safe to show in the UI. */
  display: string | null;
  source: 'supabase' | 'env' | 'unset';
  bootstrap: boolean;
}

function maskValue(value: string | null, isSecret: boolean): string | null {
  if (!value) return null;
  if (!isSecret) return value;
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}…${value.slice(-2)} (${value.length} chars)`;
}

export async function snapshotConfig(): Promise<ConfigSnapshotEntry[]> {
  const fromDb = await listFromSupabase();
  return CONFIG_KEYS.map((d) => {
    const dbValue = fromDb.get(d.key);
    const envValue = process.env[d.key]?.trim();
    const value = dbValue ?? envValue ?? null;
    const source: 'supabase' | 'env' | 'unset' = dbValue
      ? 'supabase'
      : envValue
      ? 'env'
      : 'unset';
    return {
      ...d,
      value,
      display: maskValue(value, d.isSecret),
      source,
      bootstrap: BOOTSTRAP_KEYS.has(d.key),
    };
  });
}

/** Reset the in-memory cache — used after a bulk admin save. */
export function clearRuntimeConfigCache(): void {
  cache.clear();
}

export const RUNTIME_CONFIG_INFO = {
  ttlMs: TTL_MS,
  supabaseConfigured,
};
