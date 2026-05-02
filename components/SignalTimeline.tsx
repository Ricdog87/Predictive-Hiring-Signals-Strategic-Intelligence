"use client";

import type { ScoredCompany, SignalCategory } from "@/lib/types";
import { categoryLabels } from "@/lib/format";

interface SignalTimelineProps {
  companies: ScoredCompany[];
}

const CATEGORY_COLOR: Record<SignalCategory, string> = {
  hiring_velocity: "#22D3EE",
  funding_round: "#A78BFA",
  leadership_change: "#FBBF24",
  tech_stack_shift: "#34D399",
  office_expansion: "#7DD3FC",
  layoff_pivot: "#F87171",
};

const DAYS = 90;

export function SignalTimeline({ companies }: SignalTimelineProps) {
  const now = Date.now();
  const events = companies
    .flatMap((c) =>
      c.signals.map((s) => ({
        company: c.name,
        score: c.score,
        ...s,
      }))
    )
    .map((e) => {
      const daysAgo = Math.floor(
        (now - new Date(e.detectedAt).getTime()) / 86400000
      );
      return { ...e, daysAgo };
    })
    .filter((e) => e.daysAgo >= 0 && e.daysAgo <= DAYS);

  const buckets: number[] = Array.from({ length: DAYS + 1 }, () => 0);
  events.forEach((e) => {
    buckets[DAYS - e.daysAgo] += 1;
  });
  const max = Math.max(...buckets, 1);

  const counts = (Object.keys(CATEGORY_COLOR) as SignalCategory[]).map(
    (cat) => ({
      cat,
      count: events.filter((e) => e.category === cat).length,
    })
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Signal Timeline</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            last {DAYS} days · {events.length} events
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {counts.map(({ cat, count }) => (
            <div
              key={cat}
              className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider text-text-secondary"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLOR[cat] }}
              />
              <span>{categoryLabels[cat]}</span>
              <span className="text-text-faint">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-bg-border lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bg-bg-panel p-4">
          <div className="relative h-32">
            <svg
              viewBox={`0 0 ${DAYS + 1} 100`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              {[25, 50, 75].map((g) => (
                <line
                  key={g}
                  x1={0}
                  x2={DAYS + 1}
                  y1={g}
                  y2={g}
                  stroke="#1B2030"
                  strokeWidth="0.4"
                />
              ))}
              {buckets.map((v, i) => {
                const h = (v / max) * 90;
                return (
                  <rect
                    key={i}
                    x={i + 0.15}
                    y={100 - h}
                    width={0.7}
                    height={h}
                    fill={v > 0 ? "#22D3EE" : "transparent"}
                    opacity={0.65}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between font-mono text-2xs uppercase tracking-wider text-text-faint">
              <span>−90d</span>
              <span>−60d</span>
              <span>−30d</span>
              <span>now</span>
            </div>
          </div>

          <div className="mt-4 max-h-44 overflow-y-auto pr-1">
            <ul className="divide-rule">
              {events
                .sort((a, b) => a.daysAgo - b.daysAgo)
                .slice(0, 12)
                .map((e) => (
                  <li
                    key={`${e.id}-${e.company}`}
                    className="flex items-center gap-3 py-1.5"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLOR[e.category] }}
                    />
                    <span className="num w-12 shrink-0 text-2xs uppercase tracking-wider text-text-faint">
                      −{e.daysAgo}d
                    </span>
                    <span className="w-36 shrink-0 truncate text-[12px] text-text-primary">
                      {e.company}
                    </span>
                    <span className="flex-1 truncate text-[12px] text-text-secondary">
                      {e.title}
                    </span>
                    <span className="num shrink-0 text-2xs text-accent-cyan">
                      PHS {e.score}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </div>

        <div className="bg-bg-panel p-4">
          <div className="label-eyebrow mb-3">Volume by Category</div>
          <ul className="space-y-2">
            {counts
              .sort((a, b) => b.count - a.count)
              .map(({ cat, count }) => {
                const pct = events.length === 0 ? 0 : (count / events.length) * 100;
                return (
                  <li key={cat}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-secondary">
                        {categoryLabels[cat]}
                      </span>
                      <span className="num text-text-primary">{count}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: CATEGORY_COLOR[cat],
                          opacity: 0.85,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
    </div>
  );
}
