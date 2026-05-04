/**
 * MiroFish client · v0 stub.
 *
 * Placeholder so the rest of the radar can declare its dependency
 * surface today, without wiring any production-critical path. When
 * MiroFish goes live, only this file changes and `/api/mirofish/health`
 * starts returning real status — no consumer of this module needs to
 * be touched.
 *
 * Design rules:
 *   - If `MIROFISH_BASE_URL` is unset, every method short-circuits to
 *     `{ ok:false, fellBack:true, reason:'unconfigured' }`.
 *   - Hard timeout, never throws to the caller.
 *   - The dashboard MUST stay green when MiroFish is offline.
 */

const DEFAULT_TIMEOUT_MS = Number(process.env.MIROFISH_TIMEOUT_MS ?? 8000);

function baseUrl(): string | null {
  const raw = process.env.MIROFISH_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

export function isMirofishConfigured(): boolean {
  return baseUrl() !== null;
}

export interface MirofishStatus {
  ok: boolean;
  service: string;
  version?: string;
  uptimeSec?: number;
  configured: boolean;
}

export interface MirofishError {
  ok: false;
  fellBack: true;
  reason: 'unconfigured' | 'timeout' | 'network' | 'http_error';
  detail?: string;
}

export type MirofishResult<T> = { ok: true; data: T } | MirofishError;

async function call<T>(path: string): Promise<MirofishResult<T>> {
  const root = baseUrl();
  if (!root) {
    return {
      ok: false,
      fellBack: true,
      reason: 'unconfigured',
      detail: 'MIROFISH_BASE_URL not set',
    };
  }
  const apiKey = process.env.MIROFISH_API_KEY?.trim();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${root}${path}`, {
      method: 'GET',
      headers,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        ok: false,
        fellBack: true,
        reason: 'http_error',
        detail: `${res.status}`,
      };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    const message = (err as Error).message ?? 'unknown';
    return {
      ok: false,
      fellBack: true,
      reason: message.includes('aborted') ? 'timeout' : 'network',
      detail: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function mirofishHealth(): Promise<MirofishResult<MirofishStatus>> {
  return call<MirofishStatus>('/health');
}
