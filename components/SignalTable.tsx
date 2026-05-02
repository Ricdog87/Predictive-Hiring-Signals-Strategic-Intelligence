"use client";

import type { ScoredCompany } from "@/lib/types";
import { formatPct, strengthStyles } from "@/lib/format";

interface SignalTableProps {
  companies: ScoredCompany[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SignalTable({
  companies,
  selectedId,
  onSelect,
}: SignalTableProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Hiring Signal Radar</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            sorted · PHS desc
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-2xs uppercase tracking-wider text-text-muted">
          <span>{companies.length} rows</span>
          <span className="text-text-faint">·</span>
          <span className="hover:text-accent-cyan cursor-pointer">EXPORT</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-bg-border bg-bg-surface/40 text-left">
              <Th>#</Th>
              <Th>Company</Th>
              <Th>Industry · Region</Th>
              <Th align="right">PHS</Th>
              <Th>Trend</Th>
              <Th align="right">Roles 30d</Th>
              <Th align="right">Open</Th>
              <Th align="right">HC 90d</Th>
              <Th align="right">Pred. 90d</Th>
              <Th align="right">Window</Th>
              <Th>Top Driver</Th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c, idx) => {
              const s = strengthStyles[c.strength];
              const isSelected = c.id === selectedId;
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`group cursor-pointer border-b border-bg-line/60 transition-colors ${
                    isSelected
                      ? "bg-accent-cyan/[0.06]"
                      : "hover:bg-bg-elevated/50"
                  }`}
                >
                  <td className="px-3 py-2 align-middle font-mono text-2xs text-text-faint">
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="h-3.5 w-0.5 rounded-full bg-accent-cyan" />
                      )}
                      <div>
                        <div className="font-medium text-text-primary">
                          {c.name}
                        </div>
                        <div className="font-mono text-2xs text-text-muted">
                          {c.domain}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="text-text-secondary">{c.industry}</div>
                    <div className="font-mono text-2xs text-text-muted">
                      {c.region}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <ScoreCell score={c.score} strength={c.strength} />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span
                      className={`chip ${s.text} ${s.ring} bg-bg-surface/60`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </td>
                  <td
                    className={`num px-3 py-2 text-right align-middle ${
                      c.rolesGrowth30d >= 0
                        ? "text-accent-green"
                        : "text-accent-red"
                    }`}
                  >
                    {formatPct(c.rolesGrowth30d)}
                  </td>
                  <td className="num px-3 py-2 text-right align-middle text-text-primary">
                    {c.openRoles}
                  </td>
                  <td
                    className={`num px-3 py-2 text-right align-middle ${
                      c.employeeGrowth90d >= 0
                        ? "text-accent-green"
                        : "text-accent-red"
                    }`}
                  >
                    {formatPct(c.employeeGrowth90d)}
                  </td>
                  <td className="num px-3 py-2 text-right align-middle text-accent-cyan">
                    {c.predictedRolesNext90d}
                  </td>
                  <td className="num px-3 py-2 text-right align-middle text-text-secondary">
                    {c.predictedHiringWindowDays}d
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                      {c.topDrivers[0]?.label ?? "—"}
                    </div>
                    <div className="text-2xs text-text-faint font-mono">
                      +{c.topDrivers[0]?.weight ?? 0}
                    </div>
                  </td>
                </tr>
              );
            })}
            {companies.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-12 text-center font-mono text-[11px] uppercase tracking-wider text-text-muted"
                >
                  No companies match the current query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`label-eyebrow px-3 py-2.5 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function ScoreCell({
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
  const fg =
    strength === "critical"
      ? "text-accent-violet"
      : strength === "strong"
      ? "text-accent-cyan"
      : strength === "moderate"
      ? "text-accent-amber"
      : "text-text-secondary";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`num w-7 text-right text-[13px] font-semibold ${fg}`}>
        {score}
      </span>
    </div>
  );
}
