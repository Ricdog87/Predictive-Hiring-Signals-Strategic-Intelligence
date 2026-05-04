"use client";

import type { CompanyView } from "@/lib/marketView";
import { formatPct, strengthStyles, forecastStyles } from "@/lib/format";
import { signalTypeShortLabel } from "@/lib/marketIntelligence";
import { TableEmptyState } from "./EmptyStates";
import { useWatchlist } from "@/lib/watchlist";

interface CompanySignalTableProps {
  companies: CompanyView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearFilters?: () => void;
}

export function CompanySignalTable({
  companies,
  selectedId,
  onSelect,
  onClearFilters,
}: CompanySignalTableProps) {
  const { isPinned, toggle } = useWatchlist();
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Company Signal Radar</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            sorted · hiring score desc
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-2xs uppercase tracking-wider text-text-muted">
          <Legend dot="bg-accent-green" label="Up" />
          <Legend dot="bg-accent-red" label="Down" />
          <span className="text-text-faint">·</span>
          <span>{companies.length} rows</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-bg-border bg-bg-surface/40 text-left">
              <Th>★</Th>
              <Th>#</Th>
              <Th>Company</Th>
              <Th>Sector · Region</Th>
              <Th align="right">Hiring Score</Th>
              <Th align="right">Probability</Th>
              <Th align="right">Confidence</Th>
              <Th>Forecast</Th>
              <Th align="right">Window</Th>
              <Th align="right">Signals</Th>
              <Th>Top Driver</Th>
              <Th>Flags</Th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c, idx) => {
              const s = strengthStyles[c.strength];
              const isSelected = c.id === selectedId;
              const f = forecastStyles[c.forecastBand];
              const negative = c.isNegativeFlagged;
              const driver = c.drivers[0];
              const pinned = isPinned(c.id);
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`group cursor-pointer border-b border-bg-line/50 transition-colors ${
                    isSelected ? "bg-accent-cyan/[0.07]" : "hover:bg-bg-elevated/50"
                  }`}
                >
                  <td className="px-2 py-2 align-middle">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(c.id);
                      }}
                      title={pinned ? "Unpin from watchlist" : "Pin to watchlist"}
                      aria-label={pinned ? "Unpin" : "Pin"}
                      className={`text-[14px] transition-colors ${
                        pinned
                          ? "text-accent-amber hover:text-accent-red"
                          : "text-text-faint hover:text-accent-amber"
                      }`}
                    >
                      {pinned ? "★" : "☆"}
                    </button>
                  </td>
                  <td className="px-3 py-2 align-middle font-mono text-2xs text-text-faint">
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-3.5 w-0.5 rounded-full ${
                          isSelected
                            ? "bg-accent-cyan"
                            : negative
                            ? "bg-accent-red/70"
                            : "bg-transparent"
                        }`}
                      />
                      <div>
                        <div className="font-medium text-text-primary">{c.name}</div>
                        <div className="font-mono text-2xs text-text-muted">{c.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="text-text-secondary">{c.industry}</div>
                    <div className="font-mono text-2xs text-text-muted">{c.region}</div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <ScoreCell score={c.hiringScore} strength={c.strength} />
                  </td>
                  <td className="num px-3 py-2 text-right align-middle text-text-primary">
                    <span className="text-accent-cyan">{c.hiringProbability}%</span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <ConfidenceCell confidence={c.confidenceScore} />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span className={`chip ${f.text} ${f.ring} bg-bg-surface/60`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
                      {f.label}
                    </span>
                  </td>
                  <td className="num px-3 py-2 text-right align-middle text-text-secondary">
                    {c.expectedHiringWindowDays}d
                  </td>
                  <td className="num px-3 py-2 text-right align-middle">
                    <span className="text-accent-green">+{c.positiveSignalCount}</span>
                    <span className="px-1 text-text-faint">/</span>
                    <span className="text-accent-red">−{c.negativeSignalCount}</span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {driver ? (
                      <>
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-secondary">
                          {signalTypeShortLabel(driver.signalType)}
                        </div>
                        <div
                          className={`font-mono text-2xs ${
                            driver.weight >= 0
                              ? "text-accent-green"
                              : "text-accent-red"
                          }`}
                        >
                          {formatPct(driver.weight)}
                        </div>
                      </>
                    ) : (
                      <span className="font-mono text-2xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`chip ${s.text} ${s.ring} bg-bg-surface/60`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                      {negative && (
                        <span className="chip text-accent-red ring-accent-red/40 bg-accent-red/[0.06]">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent-red" />
                          Risk
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {companies.length === 0 && (
              <tr>
                <td colSpan={12} className="px-0 py-0">
                  <TableEmptyState onClear={onClearFilters} />
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

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}

function ScoreCell({
  score,
  strength,
}: {
  score: number;
  strength: CompanyView["strength"];
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
        {Math.round(score)}
      </span>
    </div>
  );
}

function ConfidenceCell({ confidence }: { confidence: number }) {
  const fg =
    confidence >= 80
      ? "text-accent-green"
      : confidence >= 50
      ? "text-accent-ink"
      : "text-accent-amber";
  const bar =
    confidence >= 80
      ? "bg-accent-green"
      : confidence >= 50
      ? "bg-accent-ink"
      : "bg-accent-amber";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-0.5 w-14 overflow-hidden rounded-full bg-bg-surface">
        <div className={`h-full ${bar}`} style={{ width: `${confidence}%` }} />
      </div>
      <span className={`num w-7 text-right text-[12px] ${fg}`}>
        {Math.round(confidence)}
      </span>
    </div>
  );
}
