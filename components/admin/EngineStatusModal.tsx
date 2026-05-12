"use client";

import { useEffect } from "react";
import type { EngineBudgetSnapshot } from "@/lib/llmBudget";

interface EngineStatusModalProps {
  snapshot: EngineBudgetSnapshot | null;
  errorReason: string | null;
  loading: boolean;
  onRefresh: () => void;
  onClose: () => void;
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

function formatRelative(iso: string | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.round(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function toneFor(health: EngineBudgetSnapshot["health"] | undefined): {
  label: string;
  className: string;
} {
  switch (health) {
    case "green":
      return {
        label: "healthy",
        className: "text-accent-green ring-accent-green/40 bg-accent-green/10",
      };
    case "amber":
      return {
        label: "watch",
        className: "text-accent-amber ring-accent-amber/40 bg-accent-amber/10",
      };
    case "red":
      return {
        label: "critical",
        className: "text-accent-red ring-accent-red/40 bg-accent-red/10",
      };
    default:
      return {
        label: "unknown",
        className: "text-text-muted ring-bg-border bg-bg-elevated",
      };
  }
}

export function EngineStatusModal({
  snapshot,
  errorReason,
  loading,
  onRefresh,
  onClose,
}: EngineStatusModalProps) {
  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tone = toneFor(snapshot?.health);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Engine status"
      className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[10vh] palette-backdrop animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[640px] overflow-hidden rounded-md border border-bg-border bg-bg-panel shadow-glow animate-slide-down">
        <div className="flex items-center justify-between gap-3 border-b border-bg-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-accent-amber">⚙</span>
            <span className="font-mono text-2xs uppercase tracking-terminal text-accent-amber font-semibold">
              Engine status · Admin
            </span>
            {snapshot && (
              <>
                <span className="text-text-faint">·</span>
                <span className={`chip ring-1 ${tone.className}`}>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      snapshot.health === "green"
                        ? "bg-accent-green"
                        : snapshot.health === "amber"
                        ? "bg-accent-amber"
                        : snapshot.health === "red"
                        ? "bg-accent-red"
                        : "bg-text-muted"
                    }`}
                  />
                  {tone.label}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="kbd"
            title="Close (esc)"
          >
            esc
          </button>
        </div>

        <div className="max-h-[78vh] space-y-5 overflow-y-auto px-5 py-5">
          {errorReason && !snapshot && (
            <ErrorBlock reason={errorReason} />
          )}

          {!snapshot && !errorReason && (
            <div className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
              ▸ Budget-Snapshot wird geladen …
            </div>
          )}

          {snapshot && (
            <>
              <Section title="Key Status" hint="Forecast Engine sub-key">
                <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-bg-border bg-bg-border md:grid-cols-3">
                  <Cell
                    label="Spend"
                    value={formatUsd(snapshot.forecastKey.used)}
                    tone="amber"
                  />
                  <Cell
                    label="Cap"
                    value={
                      snapshot.forecastKey.limit !== null
                        ? formatUsd(snapshot.forecastKey.limit)
                        : "uncapped"
                    }
                    tone="cyan"
                  />
                  <Cell
                    label="Remaining"
                    value={
                      snapshot.forecastKey.remaining !== null
                        ? formatUsd(snapshot.forecastKey.remaining)
                        : "—"
                    }
                    tone={
                      snapshot.health === "red"
                        ? "red"
                        : snapshot.health === "amber"
                        ? "amber"
                        : "green"
                    }
                  />
                </div>
                <ProgressBar
                  used={snapshot.forecastKey.used}
                  limit={snapshot.forecastKey.limit}
                />
                <div className="mt-2 font-mono text-2xs uppercase tracking-terminal text-text-muted">
                  Label · {snapshot.forecastKey.label}
                  {typeof snapshot.forecastKey.resetSec === "number" && (
                    <>
                      <span className="text-text-faint"> · </span>
                      Reset · {Math.round(snapshot.forecastKey.resetSec / 3600)}h
                    </>
                  )}
                </div>
              </Section>

              <Section title="Account Balance" hint="Treasury">
                <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-bg-border bg-bg-border md:grid-cols-3">
                  <Cell
                    label="Balance"
                    value={formatUsd(snapshot.account.balance)}
                    tone={
                      snapshot.account.balance < 5
                        ? "red"
                        : snapshot.account.balance < 25
                        ? "amber"
                        : "green"
                    }
                  />
                  <Cell
                    label="Lifetime credits"
                    value={formatUsd(snapshot.account.totalCredits)}
                    tone="cyan"
                  />
                  <Cell
                    label="Lifetime usage"
                    value={formatUsd(snapshot.account.totalUsage)}
                    tone="violet"
                  />
                </div>
              </Section>

              <Section title="7-Day Trend" hint="usage per day">
                <Sparkline trend={snapshot.trend} />
              </Section>

              <Section title="Quick Actions">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={loading}
                    className="rounded-sm border border-accent-cyan/50 bg-accent-cyan/10 px-3 py-1.5 font-mono text-2xs uppercase tracking-terminal text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-50"
                  >
                    {loading ? "Refreshing …" : "Refresh now"}
                  </button>
                  <a
                    href="/api/admin/topup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-sm border border-accent-amber/50 bg-accent-amber/10 px-3 py-1.5 font-mono text-2xs uppercase tracking-terminal text-accent-amber hover:bg-accent-amber/20"
                  >
                    Top up at provider portal ↗
                  </a>
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-text-faint">
                  Snapshot · {formatRelative(snapshot.fetchedAt)}
                </p>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-3">
        <span className="label-eyebrow">{title}</span>
        {hint && (
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "amber" | "green" | "red" | "violet";
}) {
  const fg =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "amber"
      ? "text-accent-amber"
      : tone === "green"
      ? "text-accent-green"
      : tone === "red"
      ? "text-accent-red"
      : "text-accent-violet";
  return (
    <div className="bg-bg-panel px-4 py-3">
      <div className="label-eyebrow truncate">{label}</div>
      <div className={`num mt-1 text-[20px] font-semibold leading-none ${fg}`}>
        {value}
      </div>
    </div>
  );
}

function ProgressBar({
  used,
  limit,
}: {
  used: number;
  limit: number | null;
}) {
  if (limit === null || limit <= 0) {
    return (
      <div className="mt-3 font-mono text-2xs uppercase tracking-wider text-text-faint">
        Sub-key uncapped — relying on account balance for headroom.
      </div>
    );
  }
  const pct = Math.min(100, Math.max(0, (used / limit) * 100));
  const tone =
    pct >= 90
      ? "bg-accent-red"
      : pct >= 50
      ? "bg-accent-amber"
      : "bg-accent-green";
  return (
    <div className="mt-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-line">
        <div
          className={`h-full ${tone} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-2xs uppercase tracking-wider text-text-muted">
        <span>{pct.toFixed(1)}% spent</span>
        <span>{(100 - pct).toFixed(1)}% headroom</span>
      </div>
    </div>
  );
}

function Sparkline({ trend }: { trend?: Array<{ day: string; usage: number }> }) {
  if (!trend || trend.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-bg-line bg-bg-surface/40 px-3 py-2 font-mono text-2xs uppercase tracking-wider text-text-faint">
        Trend data unavailable
      </div>
    );
  }
  const w = 280;
  const h = 56;
  const pad = 4;
  const max = Math.max(...trend.map((p) => p.usage), 0.0001);
  const stepX = trend.length > 1 ? (w - pad * 2) / (trend.length - 1) : 0;
  const points = trend
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (p.usage / max) * (h - pad * 2);
      return `${x},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg
      role="img"
      aria-label={`Usage trend · last ${trend.length} days`}
      width={w}
      height={h}
      className="block"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-accent-cyan"
        points={points}
      />
    </svg>
  );
}

function ErrorBlock({ reason }: { reason: string }) {
  const copy =
    reason === "unconfigured"
      ? "Engine-Budget ist auf diesem Deployment nicht konfiguriert — kein API-Key gesetzt."
      : reason === "timeout"
      ? "Budget-Endpoint hat das 5-Sekunden-Zeit-Budget überschritten."
      : reason === "upstream"
      ? "Budget-Provider hat einen Fehler gemeldet."
      : reason === "network"
      ? "Netzwerkfehler beim Abruf des Budget-Snapshots."
      : `Fehler: ${reason}`;
  return (
    <div className="rounded-sm border border-accent-amber/40 bg-accent-amber/[0.06] px-3 py-2 text-[12.5px]">
      <div className="font-mono text-2xs uppercase tracking-terminal text-accent-amber font-semibold">
        Snapshot nicht verfügbar
      </div>
      <div className="mt-1 text-text-secondary">{copy}</div>
    </div>
  );
}
