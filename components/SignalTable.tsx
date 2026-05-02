"use client";

import type { ScoredCompany } from "@/lib/types";
import { formatPct, strengthStyles } from "@/lib/format";

interface SignalTableProps {
  companies: ScoredCompany[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SignalTable({ companies, selectedId, onSelect }: SignalTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-bg-border bg-bg-panel">
      <div className="flex items-center justify-between border-b border-bg-border px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">
          Hiring Signal Radar
        </h2>
        <span className="text-[11px] uppercase tracking-wider text-text-muted">
          Sorted by Predictive Hiring Score
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-bg-border bg-bg-elevated/50 text-left text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Industry</th>
              <th className="px-4 py-3 font-medium">Region</th>
              <th className="px-4 py-3 text-right font-medium">PHS</th>
              <th className="px-4 py-3 font-medium">Strength</th>
              <th className="px-4 py-3 text-right font-medium">Roles 30d Δ</th>
              <th className="px-4 py-3 text-right font-medium">Open Roles</th>
              <th className="px-4 py-3 text-right font-medium">Pred. 90d</th>
              <th className="px-4 py-3 font-medium">Top Driver</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const s = strengthStyles[c.strength];
              const isSelected = c.id === selectedId;
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`cursor-pointer border-b border-bg-border/60 transition-colors ${
                    isSelected
                      ? "bg-accent-cyan/5"
                      : "hover:bg-bg-elevated/60"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{c.name}</div>
                    <div className="text-xs text-text-muted">{c.domain}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{c.industry}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.region}</td>
                  <td className="px-4 py-3 text-right">
                    <ScoreBar score={c.score} strength={c.strength} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ring-1 ${s.ring} ${s.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      c.rolesGrowth30d >= 0
                        ? "text-accent-green"
                        : "text-accent-red"
                    }`}
                  >
                    {formatPct(c.rolesGrowth30d)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                    {c.openRoles}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent-cyan">
                    {c.predictedRolesNext90d}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {c.topDrivers[0]?.label ?? "—"}
                  </td>
                </tr>
              );
            })}
            {companies.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-text-muted"
                >
                  No companies match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreBar({
  score,
  strength,
}: {
  score: number;
  strength: ScoredCompany["strength"];
}) {
  const color =
    strength === "critical"
      ? "bg-accent-violet"
      : strength === "strong"
      ? "bg-accent-cyan"
      : strength === "moderate"
      ? "bg-accent-amber"
      : "bg-text-muted";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-elevated">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-7 text-right tabular-nums text-text-primary">
        {score}
      </span>
    </div>
  );
}
