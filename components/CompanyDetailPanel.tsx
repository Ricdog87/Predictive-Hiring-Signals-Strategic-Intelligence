"use client";

import type { CompanyView } from "@/lib/marketView";
import {
  formatPct,
  formatRelativeDays,
  strengthStyles,
  forecastStyles,
} from "@/lib/format";
import {
  signalTypeLabel,
  signalTypeAttention,
} from "@/lib/marketIntelligence";
import { HiringScoreBadge, NegativeSignalChip } from "./HiringScoreBadge";
import { InspectorEmptyState } from "./EmptyStates";

interface CompanyDetailPanelProps {
  company: CompanyView | null;
  onClose: () => void;
}

export function CompanyDetailPanel({ company, onClose }: CompanyDetailPanelProps) {
  if (!company) return <InspectorEmptyState />;

  const s = strengthStyles[company.strength];
  const f = forecastStyles[company.forecastBand];
  const negative = company.isNegativeFlagged;

  return (
    <aside className="panel sticky top-[160px] h-fit overflow-hidden">
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
        <HiringScoreBadge
          score={company.hiringScore}
          confidence={company.confidenceScore}
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
            {company.id}
          </div>
          <div className="mt-1 font-mono text-2xs uppercase tracking-wider text-text-faint">
            HQ · {company.headquarters} · {company.employeeCount.toLocaleString()} employees
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`chip ${s.text} ${s.ring} bg-bg-surface`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
            <span className={`chip ${f.text} ${f.ring} bg-bg-surface`}>
              <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
              {f.label}
            </span>
            <span className="chip ring-bg-rule text-text-secondary">
              {company.modelVersion}
            </span>
            {negative && <NegativeSignalChip />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-bg-border bg-bg-border">
        <Headline
          label="Hiring Score"
          value={Math.round(company.hiringScore).toString()}
          tone="cyan"
          hint={company.strength}
        />
        <Headline
          label="Probability"
          value={`${company.hiringProbability}%`}
          tone="violet"
          hint="next 90d"
        />
        <Headline
          label="Confidence"
          value={Math.round(company.confidenceScore).toString()}
          tone={
            company.confidenceTier === "high"
              ? "green"
              : company.confidenceTier === "medium"
              ? "ink"
              : "amber"
          }
          hint={`${company.signals.length} signals`}
        />
      </div>

      <div className="border-b border-bg-border p-5">
        <div className="label-eyebrow mb-3 flex items-center justify-between">
          <span>Top Score Drivers</span>
          <span className="text-text-faint">top {company.drivers.length}</span>
        </div>
        {company.drivers.length === 0 ? (
          <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
            no drivers yet
          </div>
        ) : (
          <div className="space-y-2.5">
            {company.drivers.map((d) => {
              const positive = d.weight >= 0;
              const tone = positive ? "bg-accent-cyan" : "bg-accent-red";
              const pct = Math.min(100, Math.abs(d.weight) * 4);
              return (
                <div key={d.signalType}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-secondary">
                      {signalTypeLabel(d.signalType)}
                    </span>
                    <span
                      className={`num ${
                        positive ? "text-accent-green" : "text-accent-red"
                      }`}
                    >
                      {formatPct(d.weight)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
                    <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-bg-border bg-bg-border">
        <Stat
          label="Window"
          value={`${company.expectedHiringWindowDays}d`}
          hint="forecast"
        />
        <Stat
          label="Roles momentum"
          value={formatPct(company.rolesMomentum)}
          hint="impact × confidence"
          hintTone={company.rolesMomentum >= 0 ? "up" : "down"}
        />
        <Stat
          label="Signals"
          value={company.signals.length.toString()}
          hint={`+${company.positiveSignalCount} / −${company.negativeSignalCount}`}
        />
        <Stat
          label="Employees"
          value={company.employeeCount.toLocaleString()}
          hint="latest"
        />
        <Stat
          label="Computed"
          value={formatRelativeDays(company.computedAt)}
          hint={company.modelVersion}
        />
        <Stat
          label="Role clusters"
          value={company.expectedRoleClusters.length.toString()}
          hint={
            company.expectedRoleClusters.slice(0, 2).join(", ") || "—"
          }
        />
      </div>

      <div className="p-5">
        <p className="text-[12.5px] leading-relaxed text-text-secondary">
          {company.description}
        </p>
        {company.reasons.length > 0 && (
          <div className="mt-3">
            <div className="label-eyebrow mb-1.5">Reasons</div>
            <ul className="space-y-1 font-mono text-[11px] text-text-secondary">
              {company.reasons.map((r, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="text-text-faint">·</span>
                  <span className="truncate">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-bg-border p-5">
        <div className="label-eyebrow mb-3 flex items-center justify-between">
          <span>Recent Company Signals</span>
          <span className="text-text-faint">{company.signals.length}</span>
        </div>
        {company.signals.length === 0 ? (
          <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
            no signals tracked
          </div>
        ) : (
          <ul className="relative space-y-3">
            <span className="absolute left-[7px] top-1 bottom-1 w-px bg-bg-rule" />
            {company.signals.map((sg) => {
              const attention = signalTypeAttention(sg.signalType);
              const dotColor =
                attention === "negative"
                  ? "bg-accent-red/80"
                  : attention === "positive"
                  ? "bg-accent-green/80"
                  : "bg-accent-cyan/70";
              const ringColor =
                attention === "negative"
                  ? "border-accent-red/50"
                  : attention === "positive"
                  ? "border-accent-green/50"
                  : "border-accent-cyan/50";
              const title = String(sg.meta?.title ?? signalTypeLabel(sg.signalType));
              return (
                <li key={sg.id} className="relative pl-6">
                  <span
                    className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border ${ringColor} bg-bg-base`}
                  >
                    <span className={`absolute inset-1 rounded-full ${dotColor}`} />
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                      {signalTypeLabel(sg.signalType)}
                    </span>
                    <span className="font-mono text-2xs text-text-faint">
                      {formatRelativeDays(sg.observedAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-text-primary">{title}</div>
                  <div className="mt-1 flex items-center justify-between font-mono text-2xs text-text-muted">
                    <span>{sg.provider}</span>
                    <span>
                      impact {sg.impact > 0 ? "+" : ""}
                      {sg.impact} · conf {(sg.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function Headline({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "cyan" | "violet" | "green" | "ink" | "amber";
  hint?: string;
}) {
  const fg =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "violet"
      ? "text-accent-violet"
      : tone === "green"
      ? "text-accent-green"
      : tone === "ink"
      ? "text-accent-ink"
      : tone === "amber"
      ? "text-accent-amber"
      : "text-text-primary";
  return (
    <div className="bg-bg-panel p-3">
      <div className="label-eyebrow">{label}</div>
      <div className={`num mt-1 text-2xl font-semibold ${fg}`}>{value}</div>
      {hint && (
        <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          {hint}
        </div>
      )}
    </div>
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
  const valueColor = tone === "cyan" ? "text-accent-cyan" : "text-text-primary";
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
