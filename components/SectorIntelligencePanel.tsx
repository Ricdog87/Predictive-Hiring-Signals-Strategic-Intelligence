"use client";

import {
  TREND_STYLES,
  signalTypeShortLabel,
} from "@/lib/marketIntelligence";
import type { SectorTrend } from "@/lib/uiContracts/market";
import { formatPct } from "@/lib/format";

interface SectorIntelligencePanelProps {
  sectors: SectorTrend[];
  selectedSector?: string | null;
  onSelectSector?: (sector: string) => void;
}

export function SectorIntelligencePanel({
  sectors,
  selectedSector,
  onSelectSector,
}: SectorIntelligencePanelProps) {
  const top = sectors.slice(0, 3);
  const maxSignals = Math.max(...sectors.map((s) => s.signalVolume), 1);
  const maxCompanies = Math.max(...sectors.map((s) => s.companyCount), 1);
  const isClickable = Boolean(onSelectSector);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Sector Intelligence</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            sector × signal volume × momentum
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          {sectors.length} sectors
        </span>
      </div>

      {top.length > 0 && (
        <div className="grid grid-cols-1 gap-px border-b border-bg-border bg-bg-border md:grid-cols-3">
          {top.map((s, i) => (
            <HottestCard
              key={s.sector}
              rank={i + 1}
              sector={s}
              selected={selectedSector === s.sector}
              onSelect={onSelectSector ? () => onSelectSector(s.sector) : undefined}
            />
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-bg-border bg-bg-surface/40 text-left">
              <Th>Sector</Th>
              <Th align="right">Companies</Th>
              <Th align="right">Avg score</Th>
              <Th align="right">Confidence</Th>
              <Th align="right">Signals</Th>
              <Th align="right">Momentum</Th>
              <Th>Trend</Th>
              <Th>Strongest signals</Th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((s) => {
              const t = TREND_STYLES[s.trendDirection];
              const selected = selectedSector === s.sector;
              return (
                <tr
                  key={s.sector}
                  onClick={isClickable ? () => onSelectSector?.(s.sector) : undefined}
                  className={`border-b border-bg-line/50 transition-colors ${
                    isClickable ? "cursor-pointer" : ""
                  } ${
                    selected
                      ? "bg-accent-cyan/[0.07]"
                      : "hover:bg-bg-elevated/40"
                  }`}
                >
                  <td className="px-3 py-2 align-middle">
                    <div className="font-medium text-text-primary">{s.sector}</div>
                    <div className="font-mono text-2xs text-text-muted">
                      {Math.round((s.companyCount / maxCompanies) * 100)}% of radar
                    </div>
                  </td>
                  <td className="num px-3 py-2 text-right align-middle text-text-primary">
                    {s.companyCount}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <ScoreCell score={s.averageScore} />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <ConfidenceCell confidence={Math.round(s.confidence * 100)} />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <SignalVolumeCell value={s.signalVolume} max={maxSignals} />
                  </td>
                  <td
                    className={`num px-3 py-2 text-right align-middle ${
                      s.momentum >= 0 ? "text-accent-green" : "text-accent-red"
                    }`}
                  >
                    {formatPct(s.momentum * 100)}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span className={`font-mono text-[13px] ${t.tone}`}>
                      {t.glyph}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {s.strongestSignalTypes.map((c) => (
                        <span
                          key={c}
                          className="chip ring-bg-rule text-text-secondary bg-bg-surface/60"
                        >
                          {signalTypeShortLabel(c)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sectors.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center font-mono text-2xs uppercase tracking-wider text-text-muted"
                >
                  No sectors available from /api/sectors.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HottestCard({
  rank,
  sector,
  selected,
  onSelect,
}: {
  rank: number;
  sector: SectorTrend;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const t = TREND_STYLES[sector.trendDirection];
  const interactive = Boolean(onSelect);
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={`relative bg-bg-panel p-4 transition-shadow ${
        interactive ? "cursor-pointer" : ""
      } ${
        selected
          ? "ring-1 ring-inset ring-accent-cyan/60"
          : interactive
          ? "hover:ring-1 hover:ring-inset hover:ring-accent-cyan/30"
          : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="label-eyebrow flex items-center gap-1.5">
            <span className="text-accent-cyan">#{rank}</span>
            <span>Hottest sector</span>
          </div>
          <div className="mt-1 text-[15px] font-semibold text-text-primary">
            {sector.sector}
          </div>
          <div className="mt-0.5 font-mono text-2xs text-text-muted">
            {sector.strongestSignalTypes
              .slice(0, 3)
              .map(signalTypeShortLabel)
              .join(" · ") || "—"}
          </div>
        </div>
        <span className={`font-mono text-base ${t.tone}`}>{t.glyph}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="num text-3xl font-semibold text-accent-cyan">
          {Math.round(sector.averageScore)}
        </span>
        <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
          avg score
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
        <div
          className="h-full bg-accent-cyan/80"
          style={{ width: `${Math.min(100, sector.averageScore)}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11.5px]">
        <Mini label="Companies" value={sector.companyCount.toString()} />
        <Mini label="Signals" value={sector.signalVolume.toString()} />
        <Mini
          label="Momentum"
          value={`${(sector.momentum * 100).toFixed(1)}%`}
          tone={sector.momentum >= 0 ? "green" : "red"}
        />
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "cyan" | "green" | "red";
}) {
  const fg =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "green"
      ? "text-accent-green"
      : tone === "red"
      ? "text-accent-red"
      : "text-text-primary";
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <div className={`num ${fg}`}>{value}</div>
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

function ScoreCell({ score }: { score: number }) {
  const s = Math.round(score);
  const fg =
    s >= 70
      ? "text-accent-cyan"
      : s >= 50
      ? "text-accent-amber"
      : "text-text-secondary";
  const bar =
    s >= 70 ? "bg-accent-cyan" : s >= 50 ? "bg-accent-amber" : "bg-text-muted";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1 w-20 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
        <div className={`h-full ${bar}`} style={{ width: `${s}%` }} />
      </div>
      <span className={`num w-7 text-right text-[12.5px] font-semibold ${fg}`}>
        {s}
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
      <span className={`num w-7 text-right text-[12px] ${fg}`}>{confidence}</span>
    </div>
  );
}

function SignalVolumeCell({ value, max }: { value: number; max: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-sm bg-bg-surface ring-1 ring-bg-border">
        <div
          className="h-full bg-accent-violet/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="num w-7 text-right text-[12px] text-text-primary">
        {value}
      </span>
    </div>
  );
}
