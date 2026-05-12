/**
 * lib/llmBudget.ts
 *
 * Snapshot the Forecast-Engine's upstream budget so the admin footer
 * widget can show spend vs. cap before a live demo runs the key empty.
 *
 * Whitelabel: the upstream is OpenRouter, but no vendor string ever
 * crosses into the customer-facing JSON. Strings are passed through
 * `scrubBudgetString()` before they leave this module.
 *
 * The function does two parallel GETs:
 *   - `/auth/key`    — per-key usage + limit + reset window
 *   - `/credits`     — account-wide balance + lifetime usage
 *
 * Both are bearer-authed with `HERMES_FORECAST_API_KEY` (the dedicated
 * sub-key the forecast routes already use). Falls back through the
 * same chain as the Strategy-Lab client when that's not set.
 *
 * 5s hard timeout via AbortController. Discriminated-union result so
 * the route can map each failure mode to a distinct HTTP status.
 */

const DEFAULT_TIMEOUT_MS = 5_000;
const UPSTREAM_BASE = 'https://openrouter.ai/api/v1';

function apiKey(): string {
  return (
    process.env.HERMES_FORECAST_API_KEY ??
    process.env.HERMES_STRATEGY_LAB_API_KEY ??
    process.env.HERMES_API_KEY ??
    process.env.OPENROUTER_API_KEY ??
    ''
  ).trim();
}

export function isBudgetConfigured(): boolean {
  return Boolean(apiKey());
}

export type BudgetHealth = 'green' | 'amber' | 'red' | 'unknown';

export interface ForecastKeyBudget {
  used: number;
  /** Hard cap on the sub-key. `null` when the key is uncapped. */
  limit: number | null;
  /** `null` when uncapped. */
  remaining: number | null;
  /** Seconds until OpenRouter resets the spend window (if any). */
  resetSec?: number;
  /** Free-text label shown on the modal — already scrubbed. */
  label: string;
}

export interface AccountBudget {
  /** Account-wide remaining balance in USD. */
  balance: number;
  totalCredits: number;
  totalUsage: number;
}

export interface EngineBudgetSnapshot {
  forecastKey: ForecastKeyBudget;
  account: AccountBudget;
  fetchedAt: string;
  health: BudgetHealth;
  /** Optional 7-day usage trend if upstream provides it. */
  trend?: Array<{ day: string; usage: number }>;
}

export type EngineBudgetReason =
  | 'unconfigured'
  | 'timeout'
  | 'upstream'
  | 'parse'
  | 'network';

export type EngineBudgetResult =
  | { ok: true; data: EngineBudgetSnapshot }
  | { ok: false; reason: EngineBudgetReason; detail?: string };

// ---------------------------------------------------------------------------
// Whitelabel guard
// ---------------------------------------------------------------------------

const VENDOR_TOKENS = [
  'OpenAI',
  'Anthropic',
  'Claude',
  'GPT-4',
  'GPT',
  'OpenRouter',
  'MiroFish',
  'OASIS',
  'Zep',
  'Qwen',
  'Sonnet',
  'Haiku',
  'Opus',
];

export function scrubBudgetString(value: string): string {
  let out = value;
  for (const token of VENDOR_TOKENS) {
    out = out.replace(new RegExp(`\\b${token}\\b`, 'gi'), '[…]');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Upstream shapes (only the fields we read — kept narrow on purpose)
// ---------------------------------------------------------------------------

interface KeyEndpointData {
  label?: string;
  usage?: number;
  limit?: number | null;
  limit_remaining?: number | null;
  is_free_tier?: boolean;
  rate_limit?: { requests?: number; interval?: string };
}

interface CreditsEndpointData {
  total_credits?: number;
  total_usage?: number;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function fetchEngineBudget(): Promise<EngineBudgetResult> {
  const key = apiKey();
  if (!key) {
    return { ok: false, reason: 'unconfigured', detail: 'API key missing' };
  }

  const controller = new AbortController();
  const tmo = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };

  try {
    const [keyRes, creditsRes] = await Promise.all([
      fetch(`${UPSTREAM_BASE}/auth/key`, {
        headers,
        signal: controller.signal,
        cache: 'no-store',
      }),
      fetch(`${UPSTREAM_BASE}/credits`, {
        headers,
        signal: controller.signal,
        cache: 'no-store',
      }),
    ]);

    if (!keyRes.ok && !creditsRes.ok) {
      const txt = await keyRes.text().catch(() => '');
      return {
        ok: false,
        reason: 'upstream',
        detail: `key=${keyRes.status} credits=${creditsRes.status} ${txt.slice(0, 120)}`,
      };
    }

    const keyJson = keyRes.ok
      ? ((await keyRes.json().catch(() => ({}))) as { data?: KeyEndpointData })
      : { data: {} as KeyEndpointData };
    const creditsJson = creditsRes.ok
      ? ((await creditsRes
          .json()
          .catch(() => ({}))) as { data?: CreditsEndpointData })
      : { data: {} as CreditsEndpointData };

    const keyData = keyJson.data ?? {};
    const creditsData = creditsJson.data ?? {};

    const used = Number.isFinite(keyData.usage) ? Number(keyData.usage) : 0;
    const limit =
      typeof keyData.limit === 'number' && Number.isFinite(keyData.limit)
        ? keyData.limit
        : null;
    const remaining =
      typeof keyData.limit_remaining === 'number'
        ? keyData.limit_remaining
        : limit !== null
        ? Math.max(0, limit - used)
        : null;

    const totalCredits = Number.isFinite(creditsData.total_credits)
      ? Number(creditsData.total_credits)
      : 0;
    const totalUsage = Number.isFinite(creditsData.total_usage)
      ? Number(creditsData.total_usage)
      : 0;
    const balance = Math.max(0, totalCredits - totalUsage);

    const health = classify(remaining, limit, balance);

    const snapshot: EngineBudgetSnapshot = {
      forecastKey: {
        used,
        limit,
        remaining,
        label: keyData.label ? scrubBudgetString(keyData.label) : 'Forecast Engine',
      },
      account: {
        balance,
        totalCredits,
        totalUsage,
      },
      fetchedAt: new Date().toISOString(),
      health,
    };

    return { ok: true, data: snapshot };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e?.name === 'AbortError') {
      return { ok: false, reason: 'timeout', detail: `>${DEFAULT_TIMEOUT_MS}ms` };
    }
    return { ok: false, reason: 'network', detail: e?.message ?? 'unknown' };
  } finally {
    clearTimeout(tmo);
  }
}

function classify(
  remaining: number | null,
  limit: number | null,
  balance: number,
): BudgetHealth {
  // Per-key first: if the sub-key cap is bound, that's the dominant signal.
  if (typeof remaining === 'number' && typeof limit === 'number' && limit > 0) {
    const pct = remaining / limit;
    if (pct < 0.1) return 'red';
    if (pct < 0.5) return 'amber';
    return 'green';
  }
  // Otherwise fall back to account balance (rough heuristic — under 5 USD
  // is "demo-fragile", under 25 USD is "watch", above that is fine).
  if (balance <= 0) return 'red';
  if (balance < 5) return 'red';
  if (balance < 25) return 'amber';
  if (balance > 0) return 'green';
  return 'unknown';
}
