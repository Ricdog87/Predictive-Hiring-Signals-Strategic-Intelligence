"use client";

import { useEffect } from "react";
import type { DataSourceStatus } from "@/lib/uiMockData";
import { signalTypeLabel } from "@/lib/marketIntelligence";

interface DataSourceDetailModalProps {
  source: DataSourceStatus | null;
  onClose: () => void;
}

export function DataSourceDetailModal({ source, onClose }: DataSourceDetailModalProps) {
  useEffect(() => {
    if (!source) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [source, onClose]);

  if (!source) return null;

  const reliabilityPct = Math.round(source.reliability * 100);
  const reliabilityTone =
    reliabilityPct >= 85
      ? "text-accent-green"
      : reliabilityPct >= 70
      ? "text-accent-cyan"
      : "text-accent-amber";
  const reliabilityBar =
    reliabilityPct >= 85
      ? "bg-accent-green"
      : reliabilityPct >= 70
      ? "bg-accent-cyan"
      : "bg-accent-amber";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-base/70 px-4 py-12 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Data source · ${source.label}`}
    >
      <div
        className="panel w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <StatusDot status={source.status} />
            <span className="label-eyebrow">Data source</span>
            <span className="font-mono text-2xs text-text-faint">
              {source.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-sm border border-bg-border bg-bg-surface px-2 py-0.5 font-mono text-2xs uppercase tracking-wider text-text-secondary hover:text-text-primary"
          >
            ✕ Close
          </button>
        </div>

        <div className="border-b border-bg-border bg-panel-gradient p-5">
          <h3 className="text-base font-semibold text-text-primary">
            {source.label}
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
            {source.description}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-px border-b border-bg-border bg-bg-border">
          <Stat label="Status" value={source.status} tone={statusTone(source.status)} />
          <Stat label="Last sync" value={source.lastSync} />
          <Stat label="Throughput" value={`${source.signalsPerHour}/h`} />
        </div>

        <div className="border-b border-bg-border p-5">
          <div className="label-eyebrow mb-2">Reliability / confidence</div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
              <div
                className={`h-full ${reliabilityBar}`}
                style={{ width: `${reliabilityPct}%` }}
              />
            </div>
            <span className={`num text-[14px] font-semibold ${reliabilityTone}`}>
              {reliabilityPct}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="label-eyebrow mb-2">Covered signal types</div>
          {source.coveredSignalTypes.length === 0 ? (
            <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
              none
            </span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {source.coveredSignalTypes.map((t) => (
                <span
                  key={t}
                  className="chip ring-bg-rule text-text-secondary bg-bg-surface/60"
                >
                  {signalTypeLabel(t)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function statusTone(status: DataSourceStatus["status"]): "green" | "amber" | "red" | "ink" {
  if (status === "live") return "green";
  if (status === "idle") return "amber";
  if (status === "down") return "red";
  return "ink";
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber" | "red" | "ink";
}) {
  const fg =
    tone === "green"
      ? "text-accent-green"
      : tone === "amber"
      ? "text-accent-amber"
      : tone === "red"
      ? "text-accent-red"
      : tone === "ink"
      ? "text-accent-ink"
      : "text-text-primary";
  return (
    <div className="bg-bg-panel p-3">
      <div className="label-eyebrow">{label}</div>
      <div className={`num mt-1 text-[14px] font-medium uppercase ${fg}`}>
        {value}
      </div>
    </div>
  );
}

function StatusDot({
  status,
}: {
  status: DataSourceStatus["status"];
}) {
  const color =
    status === "live"
      ? "bg-accent-green"
      : status === "idle"
      ? "bg-accent-amber"
      : status === "down"
      ? "bg-accent-red"
      : "bg-accent-ink";
  return (
    <span className="relative inline-flex h-1.5 w-1.5">
      <span
        className={`absolute inset-0 rounded-full ${color} ${
          status === "live" ? "animate-pulse-soft" : ""
        }`}
      />
    </span>
  );
}
