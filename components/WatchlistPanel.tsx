"use client";

import { UI_WATCHLISTS } from "@/lib/uiMockData";

export function WatchlistPanel() {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Watchlists</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            curated cohorts · UI scaffold
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          {UI_WATCHLISTS.length} lists
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-bg-border md:grid-cols-2 xl:grid-cols-4">
        {UI_WATCHLISTS.map((w) => {
          const trend = pseudoTrend(w.id);
          return (
            <div key={w.id} className="bg-bg-panel p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {w.pinned && (
                      <span className="text-accent-amber font-mono text-[12px]">
                        ★
                      </span>
                    )}
                    <span className="truncate text-[13px] font-medium text-text-primary">
                      {w.name}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-2xs text-text-faint">
                    {w.id}
                  </div>
                </div>
                <span className="num text-base text-accent-cyan">{w.count}</span>
              </div>

              <p className="mt-2 text-[11.5px] leading-snug text-text-secondary">
                {w.hint}
              </p>

              <div className="mt-3">
                <div className="label-eyebrow mb-1">7d activity</div>
                <Trend points={trend} />
              </div>

              <div className="mt-3 flex items-center justify-between font-mono text-2xs uppercase tracking-wider">
                <span className="text-text-muted">avg PHS</span>
                <span className="text-text-primary">
                  {pseudoScore(w.id)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pseudoTrend(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: 12 }).map((_, i) => {
    return 30 + ((h * (i + 1)) % 70);
  });
}

function pseudoScore(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 55 + (h % 30);
}

function Trend({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  const d = points
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * 100} ${
          100 - (v / max) * 100
        }`
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="100%"
      height="32"
    >
      <defs>
        <linearGradient id={`wlg-${points.join("-").slice(0, 6)}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L 100 100 L 0 100 Z`}
        fill={`url(#wlg-${points.join("-").slice(0, 6)})`}
      />
      <path d={d} fill="none" stroke="#22D3EE" strokeWidth="1.4" />
    </svg>
  );
}
