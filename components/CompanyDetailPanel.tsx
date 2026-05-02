"use client";

import type { ScoredCompany } from "@/lib/types";
import {
  categoryLabels,
  formatPct,
  formatRelativeDays,
  strengthStyles,
} from "@/lib/format";

interface CompanyDetailPanelProps {
  company: ScoredCompany | null;
  onClose: () => void;
}

export function CompanyDetailPanel({ company, onClose }: CompanyDetailPanelProps) {
  if (!company) {
    return (
      <aside className="hidden xl:block xl:sticky xl:top-6 h-fit rounded-xl border border-dashed border-bg-border bg-bg-panel/50 p-6 text-sm text-text-muted">
        Select a company in the radar to inspect its signal breakdown,
        leadership and tech-stack movement, and predicted hiring window.
      </aside>
    );
  }

  const s = strengthStyles[company.strength];

  return (
    <aside className="xl:sticky xl:top-6 h-fit rounded-xl border border-bg-border bg-bg-panel">
      <div className="flex items-start justify-between border-b border-bg-border p-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-muted">
            <span>{company.industry}</span>
            <span>·</span>
            <span>{company.region}</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-text-primary">
            {company.name}
          </h2>
          <div className="text-xs text-text-secondary">
            {company.domain} · {company.headquarters}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-bg-border bg-bg-elevated px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
        >
          Close
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-lg border border-bg-border bg-bg-elevated/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-text-muted">
                Predictive Hiring Score
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-text-primary">
                  {company.score}
                </span>
                <span className="text-xs text-text-muted">/ 100</span>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ${s.ring} ${s.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {company.topDrivers.map((d) => (
              <div key={d.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{d.label}</span>
                  <span className="tabular-nums text-text-primary">
                    +{d.weight}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg-base">
                  <div
                    className="h-full bg-accent-cyan/70"
                    style={{ width: `${Math.min(100, d.weight * 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-text-secondary">{company.description}</p>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Employees" value={company.employees.toString()} hint={formatPct(company.employeeGrowth90d) + " · 90d"} />
          <Stat label="Open roles" value={company.openRoles.toString()} hint={formatPct(company.rolesGrowth30d) + " · 30d"} />
          <Stat
            label="Funding"
            value={company.fundingStage}
            hint={
              company.lastFundingAmountM > 0
                ? `$${company.lastFundingAmountM}M · ${company.lastFundingMonthsAgo}mo ago`
                : "—"
            }
          />
          <Stat
            label="Predicted window"
            value={`${company.predictedHiringWindowDays}d`}
            hint={`${company.predictedRolesNext90d} roles · 90d`}
          />
          <Stat
            label="Leadership Δ"
            value={company.leadershipChanges90d.toString()}
            hint="last 90 days"
          />
          <Stat
            label="Tech stack Δ"
            value={company.techStackShifts.toString()}
            hint="last 90 days"
          />
        </div>

        <div>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-text-muted">
            Recent Signals
          </div>
          <ul className="space-y-2">
            {company.signals.map((sg) => (
              <li
                key={sg.id}
                className="rounded-lg border border-bg-border bg-bg-elevated/40 p-3"
              >
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{categoryLabels[sg.category]}</span>
                  <span>{formatRelativeDays(sg.detectedAt)}</span>
                </div>
                <div className="mt-1 text-sm text-text-primary">{sg.title}</div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
                  <span>{sg.source}</span>
                  <span>conf {(sg.confidence * 100).toFixed(0)}%</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg-elevated/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-text-muted">
        {label}
      </div>
      <div className="mt-1 text-base font-medium text-text-primary">{value}</div>
      {hint && <div className="text-[11px] text-text-secondary">{hint}</div>}
    </div>
  );
}
