"use client";

import { useEffect, useState } from "react";
import { AnimatedNumber } from "./AnimatedNumber";

interface MacroState {
  ecb?: { rate: number; period: string };
  inflation?: { rate: number; period: string };
  unemployment?: { rate: number; period: string };
  employment?: { rate: number; period: string };
  jobVacancy?: { rate: number; period: string };
  cli?: { value: number; period: string; trend: 'expanding' | 'slowing' | 'contracting' | 'recovering' | 'flat' };
  loading: boolean;
  errorCount: number;
}

interface PeriodicSpec {
  url: string;
  key: keyof Omit<MacroState, 'loading' | 'errorCount'>;
  pick: (json: Record<string, unknown>) => unknown;
}

const SPECS: PeriodicSpec[] = [
  {
    url: '/api/macro/ecb-rate',
    key: 'ecb',
    pick: (j) => (j.ok && typeof j.rate === 'number' ? { rate: j.rate, period: j.period } : undefined),
  },
  {
    url: '/api/macro/inflation',
    key: 'inflation',
    pick: (j) => (j.ok && typeof j.rate === 'number' ? { rate: j.rate, period: j.period } : undefined),
  },
  {
    url: '/api/macro/de-unemployment',
    key: 'unemployment',
    pick: (j) => (j.ok && typeof j.rate === 'number' ? { rate: j.rate, period: j.period } : undefined),
  },
  {
    url: '/api/macro/employment',
    key: 'employment',
    pick: (j) => (j.ok && typeof j.rate === 'number' ? { rate: j.rate, period: j.period } : undefined),
  },
  {
    url: '/api/macro/job-vacancy',
    key: 'jobVacancy',
    pick: (j) => (j.ok && typeof j.rate === 'number' ? { rate: j.rate, period: j.period } : undefined),
  },
  {
    url: '/api/macro/cli',
    key: 'cli',
    pick: (j) =>
      j.ok && typeof j.value === 'number'
        ? { value: j.value, period: j.period, trend: j.trend }
        : undefined,
  },
];

export function MacroStrip() {
  const [state, setState] = useState<MacroState>({ loading: true, errorCount: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settled = await Promise.allSettled(
        SPECS.map(async (s) => {
          const res = await fetch(s.url, { cache: 'force-cache' });
          if (!res.ok) throw new Error(`${s.key} status ${res.status}`);
          const j = (await res.json()) as Record<string, unknown>;
          return { key: s.key, value: s.pick(j) };
        })
      );
      if (cancelled) return;
      const next: MacroState = { loading: false, errorCount: 0 };
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value.value) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (next as any)[r.value.key] = r.value.value;
        } else {
          next.errorCount += 1;
        }
      }
      setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-label="DE macro pulse"
      className="border-b border-bg-border bg-bg-surface"
    >
      <div className="px-5 py-2 border-b border-bg-line/60 flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-terminal">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan animate-pulse-soft" />
          <span className="text-accent-cyan font-semibold">Macro · DE / EUR</span>
          <span className="text-text-faint">·</span>
          <span className="text-text-secondary">live</span>
          {state.errorCount > 0 && (
            <>
              <span className="text-text-faint">·</span>
              <span className="text-accent-amber">{state.errorCount} degraded</span>
            </>
          )}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-bg-border md:grid-cols-3 xl:grid-cols-6">
        <Tile
          label="ECB Leitzins"
          value={state.ecb?.rate}
          suffix="%"
          decimals={2}
          period={state.ecb?.period}
          tone="violet"
          source="ECB main refinancing"
        />
        <Tile
          label="DE Inflation (HICP)"
          value={state.inflation?.rate}
          suffix="%"
          decimals={1}
          period={state.inflation?.period}
          tone="amber"
          source="ECB SDW · jährlich"
        />
        <Tile
          label="DE Arbeitslosenquote"
          value={state.unemployment?.rate}
          suffix="%"
          decimals={1}
          period={state.unemployment?.period}
          tone="cyan"
          source="Eurostat · monatlich SA"
        />
        <Tile
          label="DE Beschäftigungsquote"
          value={state.employment?.rate}
          suffix="%"
          decimals={1}
          period={state.employment?.period}
          tone="green"
          source="Eurostat · 15-64 SA"
        />
        <Tile
          label="DE Vakanzquote"
          value={state.jobVacancy?.rate}
          suffix="%"
          decimals={1}
          period={state.jobVacancy?.period}
          tone="cyan"
          source="Eurostat · jvs_q_nace2"
        />
        <Tile
          label="DE CLI · Frühindikator"
          value={state.cli?.value}
          decimals={1}
          period={state.cli?.period}
          tone={
            state.cli?.trend === 'expanding' || state.cli?.trend === 'recovering'
              ? 'green'
              : state.cli?.trend === 'slowing' || state.cli?.trend === 'contracting'
              ? 'red'
              : 'violet'
          }
          source={state.cli?.trend ? `OECD · ${state.cli.trend}` : 'OECD · MEI'}
        />
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  decimals = 0,
  suffix,
  period,
  tone,
  source,
}: {
  label: string;
  value: number | undefined;
  decimals?: number;
  suffix?: string;
  period?: string;
  tone?: 'cyan' | 'violet' | 'amber' | 'green' | 'red';
  source?: string;
}) {
  const fg =
    tone === 'cyan'
      ? 'text-accent-cyan'
      : tone === 'violet'
      ? 'text-accent-violet'
      : tone === 'amber'
      ? 'text-accent-amber'
      : tone === 'green'
      ? 'text-accent-green'
      : tone === 'red'
      ? 'text-accent-red'
      : 'text-text-primary';
  const empty = value === undefined;
  return (
    <div
      className="bg-bg-panel px-4 py-2.5 transition-colors hover:bg-bg-elevated/40"
      title={source}
    >
      <div className="flex items-center justify-between">
        <span className="label-eyebrow truncate">{label}</span>
        <span className="flex items-center gap-1 text-2xs font-mono text-text-faint">
          {empty ? (
            <>
              <span className="h-1 w-1 rounded-full bg-text-muted" />
              <span>—</span>
            </>
          ) : (
            <>
              <span className="h-1 w-1 rounded-full bg-accent-green animate-pulse-soft" />
              <span>live</span>
            </>
          )}
        </span>
      </div>
      <div className={`mt-1 text-[15px] font-semibold ${fg}`}>
        {empty ? (
          <span className="num text-text-muted">—</span>
        ) : (
          <AnimatedNumber
            value={value!}
            decimals={decimals}
            suffix={suffix}
            className="num"
          />
        )}
      </div>
      {period && (
        <div className="text-2xs font-mono uppercase tracking-wider text-text-muted">
          {period}
        </div>
      )}
    </div>
  );
}
