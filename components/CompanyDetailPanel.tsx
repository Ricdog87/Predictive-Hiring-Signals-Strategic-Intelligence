"use client";

import type { ScoredCompany } from "@/lib/types";
import {
  categoryLabels,
  formatPct,
  formatRelativeDays,
  strengthStyles,
} from "@/lib/format";
import { ScoreBadge } from "./ScoreBadge";

interface CompanyDetailPanelProps {
  company: ScoredCompany | null;
  onClose: () => void;
}

export function CompanyDetailPanel({
  company,
  onClose,
}: CompanyDetailPanelProps) {
  if (!company) {
    return (
      <aside className="panel sticky top-[120px] hidden h-fit p-6 xl:block">
        <div className="label-eyebrow mb-3">Inspector</div>
        <div className="rounded-sm border border-dashed border-bg-rule bg-bg-surface/40 p-6 text-[12px] text-text-muted">
          Select a row in the radar to inspect the score breakdown,
          leadership/tech-stack movement, and signal stream.
        </div>
        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-bg-border bg-bg-border">
          {[
            { label: "Drivers", value: "—" },
            { label: "Signals", value: "—" },
            { label: "Window", value: "—" },
          ].map((b) => (
            <div key={b.label} className="bg-bg-panel p-3">
              <div className="label-eyebrow">{b.label}</div>
              <div className="num mt-1 text-base text-text-primary">
                {b.value}
              </div>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  const s = strengthStyles[company.strength];

  return (
    <aside className="panel sticky top-[120px] h-fit overflow-hidden xl:block">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="label-eyebrow">Inspector</span>
          <span className="font-mono text-2xs text-text-faint">
            {company.id.toUpperCase()}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm border border-bg-border bg-bg-surface px-2 py-0.5 font-mono text-2xs uppercase tracking-wider text-text-secondary hover:text-text-primary"
        >
          ✕ Close
        </button>
      </div>

      <div className="flex items-start gap-4 border-b border-bg-border bg-panel-gradient p-5">
        <ScoreBadge
          score={company.score}
          strength={company.strength}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
            <span>{company.industry}</span>
            <span className="text-text-faint">·</span>
            <span>{company.region}</span>
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold text-text-primary">
            {company.name}
          </h2>
          <div className="font-mono text-[11px] text-text-secondary">
            {company.domain}
          </div>
          <div className="mt-1 font-mono text-2xs uppercase tracking-wider text-text-faint">
            {company.headquarters}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`chip ${s.text} ${s.ring} bg-bg-surface`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
            <span className="chip ring-bg-rule text-text-secondary">
              {company.fundingStage}
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-bg-border p-5">
        <div className="label-eyebrow mb-3 flex items-center justify-between">
          <span>Score Drivers</span>
          <span className="text-text-faint">top 3 of 8</span>
        </div>
        <div className="space-y-2.5">
          {company.topDrivers.map((d) => (
            <div key={d.label}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-secondary">{d.label}</span>
                <span className="num text-text-primary">+{d.weight}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
                <div
                  className="h-full bg-gradient-to-r from-accent-cyan/40 to-accent-cyan"
                  style={{ width: `${Math.min(100, d.weight * 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-bg-border bg-bg-border">
        <Stat label="Employees" value={company.employees.toLocaleString()} hint={formatPct(company.employeeGrowth90d)} hintTone={company.employeeGrowth90d >= 0 ? "up" : "down"} />
        <Stat label="Open roles" value={company.openRoles.toString()} hint={formatPct(company.rolesGrowth30d)} hintTone={company.rolesGrowth30d >= 0 ? "up" : "down"} />
        <Stat
          label="Funding"
          value={
            company.lastFundingAmountM > 0
              ? `$${company.lastFundingAmountM}M`
              : "—"
          }
          hint={
            company.lastFundingMonthsAgo > 0
              ? `${company.lastFundingMonthsAgo}mo`
              : "—"
          }
        />
        <Stat
          label="Pred. 90d"
          value={company.predictedRolesNext90d.toString()}
          hint="roles"
          tone="cyan"
        />
        <Stat
          label="Window"
          value={`${company.predictedHiringWindowDays}d`}
          hint="forecast"
        />
        <Stat
          label="Lead. Δ"
          value={company.leadershipChanges90d.toString()}
          hint="last 90d"
        />
      </div>

      <div className="p-5">
        <p className="text-[12.5px] leading-relaxed text-text-secondary">
          {company.description}
        </p>
      </div>

      <div className="border-t border-bg-border p-5">
        <div className="label-eyebrow mb-3 flex items-center justify-between">
          <span>Recent Signals</span>
          <span className="text-text-faint">{company.signals.length}</span>
        </div>
        <ul className="relative space-y-3">
          <span className="absolute left-[7px] top-1 bottom-1 w-px bg-bg-rule" />
          {company.signals.map((sg) => (
            <li key={sg.id} className="relative pl-6">
              <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border border-accent-cyan/50 bg-bg-base">
                <span className="absolute inset-1 rounded-full bg-accent-cyan/70" />
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                  {categoryLabels[sg.category]}
                </span>
                <span className="font-mono text-2xs text-text-faint">
                  {formatRelativeDays(sg.detectedAt)}
                </span>
              </div>
              <div className="mt-0.5 text-[12.5px] text-text-primary">
                {sg.title}
              </div>
              <div className="mt-1 flex items-center justify-between font-mono text-2xs text-text-muted">
                <span>{sg.source}</span>
                <span>conf {(sg.confidence * 100).toFixed(0)}%</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function Stat({
  label,
  value,
  hint,
  hintTone,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "up" | "down";
  tone?: "cyan";
}) {
  const valueColor =
    tone === "cyan" ? "text-accent-cyan" : "text-text-primary";
  const hintColor =
    hintTone === "up"
      ? "text-accent-green"
      : hintTone === "down"
      ? "text-accent-red"
      : "text-text-muted";
  return (
    <div className="bg-bg-panel p-3">
      <div className="label-eyebrow">{label}</div>
      <div className={`num mt-1 text-[15px] font-medium ${valueColor}`}>
        {value}
      </div>
      {hint && (
        <div className={`font-mono text-2xs uppercase tracking-wider ${hintColor}`}>
          {hint}
        </div>
      )}
    </div>
  );
}
