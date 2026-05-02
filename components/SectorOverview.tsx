"use client";

import type { ScoredCompany } from "@/lib/types";
import { getSectorAggregates } from "@/lib/uiDerivations";
import { formatPct } from "@/lib/format";

interface SectorOverviewProps {
  companies: ScoredCompany[];
}

export function SectorOverview({ companies }: SectorOverviewProps) {
  const sectors = getSectorAggregates(companies);
  const maxRoles = Math.max(...sectors.map((s) => s.predictedRoles), 1);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Sector Pulse</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            aggregated · current radar
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          {sectors.length} sectors
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-bg-border md:grid-cols-2 xl:grid-cols-4">
        {sectors.map((s) => {
          const scoreColor =
            s.avgScore >= 70
              ? "text-accent-cyan"
              : s.avgScore >= 50
              ? "text-accent-amber"
              : "text-text-secondary";
          const heat =
            s.avgScore >= 70
              ? "bg-accent-cyan"
              : s.avgScore >= 50
              ? "bg-accent-amber"
              : "bg-text-muted";
          const momentumTone =
            s.momentum >= 0 ? "text-accent-green" : "text-accent-red";

          return (
            <div key={s.sector} className="bg-bg-panel p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="label-eyebrow">{s.sector}</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className={`num text-2xl font-semibold ${scoreColor}`}>
                      {s.avgScore}
                    </span>
                    <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
                      avg PHS
                    </span>
                  </div>
                </div>
                {s.negativeFlags > 0 && (
                  <span className="chip text-accent-red ring-accent-red/40 bg-accent-red/[0.06]">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-red" />
                    {s.negativeFlags} risk
                  </span>
                )}
              </div>

              <div className="mt-3 flex h-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
                <div className={heat} style={{ width: `${s.avgScore}%` }} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
                <Stat
                  label="Companies"
                  value={s.companies.toString()}
                />
                <Stat
                  label="Confidence"
                  value={`${s.avgConfidence}`}
                />
                <Stat
                  label="Pred. roles"
                  value={s.predictedRoles.toLocaleString()}
                  tone="cyan"
                />
                <Stat
                  label="Roles Δ 30d"
                  value={formatPct(s.momentum)}
                  toneClass={momentumTone}
                />
              </div>

              <div className="mt-3">
                <div className="label-eyebrow mb-1">Pred. roles · share</div>
                <div className="flex h-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
                  <div
                    className="bg-accent-cyan/80"
                    style={{
                      width: `${(s.predictedRoles / maxRoles) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  toneClass,
}: {
  label: string;
  value: string;
  tone?: "cyan";
  toneClass?: string;
}) {
  const fg =
    toneClass ?? (tone === "cyan" ? "text-accent-cyan" : "text-text-primary");
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span className={`num ${fg}`}>{value}</span>
    </div>
  );
}
