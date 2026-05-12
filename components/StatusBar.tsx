"use client";

import { useEffect, useState } from "react";
import { EngineStatusWidget } from "@/components/admin";

interface StatusBarProps {
  /** ms latency of the last successful API roundtrip. */
  latencyMs?: number | null;
  /** ISO timestamp of the last successful sync. */
  lastSyncAt?: string | null;
  /** Currently active API endpoint count or status. */
  apiOk?: boolean;
  /** Parent-driven force-open hook for the Engine Status modal (hotkey g e). */
  engineModalOpen?: boolean;
  onEngineModalOpenChange?: (open: boolean) => void;
}

function relTime(iso: string): string {
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

export function StatusBar({
  latencyMs,
  lastSyncAt,
  apiOk = true,
  engineModalOpen,
  onEngineModalOpenChange,
}: StatusBarProps) {
  const [tick, setTick] = useState(0);
  // re-render every 10s so "Xm ago" stays fresh
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  const tone =
    !apiOk
      ? "bg-accent-red"
      : (latencyMs ?? 0) > 1500
      ? "bg-accent-amber"
      : "bg-accent-green";

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky bottom-0 z-30 flex items-center justify-between gap-4 border-t border-bg-border bg-bg-surface/90 px-5 py-1.5 font-mono text-2xs uppercase tracking-terminal text-text-muted backdrop-blur"
    >
      <div className="flex items-center gap-4 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${tone} animate-pulse-soft`} />
          <span className={apiOk ? "text-accent-green" : "text-accent-red"}>
            {apiOk ? "live" : "degraded"}
          </span>
        </span>
        <span className="text-text-faint">·</span>
        <span>
          latency{" "}
          <span className="text-text-secondary num">
            {latencyMs != null ? `${Math.round(latencyMs)}ms` : "—"}
          </span>
        </span>
        <span className="text-text-faint">·</span>
        <span>
          sync{" "}
          <span className="text-text-secondary">
            {lastSyncAt ? relTime(lastSyncAt) : "—"}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <EngineStatusWidget
          forceOpen={engineModalOpen}
          onOpenChange={onEngineModalOpenChange}
        />
        <span className="hidden md:flex items-center gap-1.5">
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
          <span>search</span>
        </span>
        <span className="hidden md:flex items-center gap-1.5">
          <span className="kbd">g</span>
          <span className="kbd">s</span>
          <span>sectors</span>
        </span>
        <span className="hidden lg:flex items-center gap-1.5">
          <span className="kbd">g</span>
          <span className="kbd">c</span>
          <span>clusters</span>
        </span>
        <span className="hidden lg:flex items-center gap-1.5">
          <span className="kbd">?</span>
          <span>help</span>
        </span>
      </div>
    </div>
  );
}
