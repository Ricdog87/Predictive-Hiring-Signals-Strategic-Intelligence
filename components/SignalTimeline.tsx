"use client";

import type { ScoredCompany, SignalCategory } from "@/lib/types";
import { categoryLabels } from "@/lib/format";
import { getCategoryAttention } from "@/lib/uiDerivations";
import { PanelEmpty } from "./EmptyStates";

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

  const buckets: { total: number; negative: number }[] = Array.from(
    { length: DAYS + 1 },
    () => ({ total: 0, negative: 0 })
  );
  events.forEach((e) => {
    const i = DAYS - e.daysAgo;
    buckets[i].total += 1;
    if (e.category === "layoff_pivot") buckets[i].negative += 1;
  });
  const max = Math.max(...buckets.map((b) => b.total), 1);

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
          <span className="label-eyebrow">Signal Timeline · 90d</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            {events.length} company signals
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

      {events.length === 0 ? (
        <PanelEmpty
          title="No signals in window"
          hint="No company signals were detected in the last 90 days for the active query."
        />
      ) : (
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
                {buckets.map((b, i) => {
                  const h = (b.total / max) * 90;
                  const negH = (b.negative / max) * 90;
                  return (
                    <g key={i}>
                      <rect
                        x={i + 0.15}
                        y={100 - h}
                        width={0.7}
                        height={h}
                        fill={b.total > 0 ? "#22D3EE" : "transparent"}
                        opacity={0.65}
                      />
                      {negH > 0 && (
                        <rect
                          x={i + 0.15}
                          y={100 - negH}
                          width={0.7}
                          height={negH}
                          fill="#F87171"
                          opacity={0.85}
                        />
                      )}
                    </g>
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
                  .slice(0, 14)
                  .map((e) => {
                    const attention = getCategoryAttention(e.category);
                    return (
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
                        <span
                          className={`flex-1 truncate text-[12px] ${
                            attention === "negative"
                              ? "text-accent-red"
                              : "text-text-secondary"
                          }`}
                        >
                          {e.title}
                        </span>
                        <span className="num shrink-0 text-2xs text-accent-cyan">
                          PHS {e.score}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>

          <div className="bg-bg-panel p-4">
            <div className="label-eyebrow mb-3">Volume by Category</div>
            <ul className="space-y-2">
              {counts
                .sort((a, b) => b.count - a.count)
                .map(({ cat, count }) => {
                  const pct =
                    events.length === 0 ? 0 : (count / events.length) * 100;
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
            <div className="mt-4 rounded-sm border border-bg-border bg-bg-surface/50 p-2.5">
              <div className="label-eyebrow">Negative Signals</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="num text-lg text-accent-red">
                  {events.filter((e) => e.category === "layoff_pivot").length}
                </span>
                <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                  layoff / pivot
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
