/**
 * Cost guardrail · v1.
 *
 * Coarse-grained but effective: caps requests per minute and per day
 * separately for the two tiers. Counters live in process memory and
 * reset automatically on the next window — fine for a single-instance
 * Hostinger deployment. If we ever scale Hermes horizontally, swap the
 * counters for a Redis impl behind the same `recordRequest` function.
 */

type Tier = 'fast' | 'deep' | 'live';

interface Window {
  count: number;
  resetAt: number;
}

interface State {
  perMinute: Record<Tier, Window>;
  perDay: Record<Tier, Window>;
}

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

function newWindow(spanMs: number): Window {
  return { count: 0, resetAt: Date.now() + spanMs };
}

const state: State = {
  perMinute: {
    fast: newWindow(MS_PER_MINUTE),
    deep: newWindow(MS_PER_MINUTE),
    live: newWindow(MS_PER_MINUTE),
  },
  perDay: {
    fast: newWindow(MS_PER_DAY),
    deep: newWindow(MS_PER_DAY),
    live: newWindow(MS_PER_DAY),
  },
};

function limit(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function rotate(window: Window, spanMs: number): void {
  if (Date.now() >= window.resetAt) {
    window.count = 0;
    window.resetAt = Date.now() + spanMs;
  }
}

export interface BudgetDecision {
  allowed: boolean;
  reason?: string;
  remainingMinute: number;
  remainingDay: number;
}

export function recordRequest(tier: Tier): BudgetDecision {
  const minLimit = limit(
    tier === 'deep' ? 'HERMES_RPM_DEEP' : tier === 'live' ? 'HERMES_RPM_LIVE' : 'HERMES_RPM_FAST',
    tier === 'deep' ? 6 : tier === 'live' ? 4 : 30
  );
  const dayLimit = limit(
    tier === 'deep' ? 'HERMES_RPD_DEEP' : tier === 'live' ? 'HERMES_RPD_LIVE' : 'HERMES_RPD_FAST',
    tier === 'deep' ? 200 : tier === 'live' ? 100 : 3000
  );

  const min = state.perMinute[tier];
  const day = state.perDay[tier];
  rotate(min, MS_PER_MINUTE);
  rotate(day, MS_PER_DAY);

  if (min.count >= minLimit) {
    return {
      allowed: false,
      reason: `rate limit · ${minLimit}/min · tier=${tier}`,
      remainingMinute: 0,
      remainingDay: Math.max(0, dayLimit - day.count),
    };
  }
  if (day.count >= dayLimit) {
    return {
      allowed: false,
      reason: `daily cap · ${dayLimit}/day · tier=${tier}`,
      remainingMinute: Math.max(0, minLimit - min.count),
      remainingDay: 0,
    };
  }

  min.count += 1;
  day.count += 1;
  return {
    allowed: true,
    remainingMinute: Math.max(0, minLimit - min.count),
    remainingDay: Math.max(0, dayLimit - day.count),
  };
}

export interface BudgetSnapshot {
  tier: Tier;
  perMinute: { used: number; limit: number; resetInSec: number };
  perDay: { used: number; limit: number; resetInSec: number };
}

export function snapshot(): BudgetSnapshot[] {
  const tiers: Tier[] = ['fast', 'deep', 'live'];
  return tiers.map((tier) => {
    const minLimit = limit(
      tier === 'deep' ? 'HERMES_RPM_DEEP' : 'HERMES_RPM_FAST',
      tier === 'deep' ? 6 : 30
    );
    const dayLimit = limit(
      tier === 'deep' ? 'HERMES_RPD_DEEP' : 'HERMES_RPD_FAST',
      tier === 'deep' ? 200 : 3000
    );
    return {
      tier,
      perMinute: {
        used: state.perMinute[tier].count,
        limit: minLimit,
        resetInSec: Math.max(
          0,
          Math.round((state.perMinute[tier].resetAt - Date.now()) / 1000)
        ),
      },
      perDay: {
        used: state.perDay[tier].count,
        limit: dayLimit,
        resetInSec: Math.max(
          0,
          Math.round((state.perDay[tier].resetAt - Date.now()) / 1000)
        ),
      },
    };
  });
}
