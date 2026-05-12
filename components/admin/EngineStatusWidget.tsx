"use client";

import { useCallback, useEffect, useState } from "react";
import type { EngineBudgetSnapshot } from "@/lib/llmBudget";
import { EngineStatusModal } from "./EngineStatusModal";

const ADMIN_TOKEN_STORAGE_KEY = "rsg.admin.token.v1";
const POLL_INTERVAL_MS = 60_000;

interface ApiResponse {
  ok: boolean;
  data?: EngineBudgetSnapshot;
  reason?: string;
  detail?: string;
}

interface EngineStatusWidgetProps {
  /** Override for tests / Storybook. Otherwise read from localStorage. */
  adminToken?: string | null;
  /** Open modal hook for parent-driven hotkey integration. */
  forceOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function readAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 100) return `$${value.toFixed(0)}`;
  return `$${value.toFixed(2)}`;
}

function toneFor(health: EngineBudgetSnapshot["health"]): string {
  switch (health) {
    case "green":
      return "text-accent-green";
    case "amber":
      return "text-accent-amber";
    case "red":
      return "text-accent-red";
    default:
      return "text-text-muted";
  }
}

/**
 * Footer inline widget. Renders nothing for non-admin sessions.
 * Polls every 60s, opens a detail modal on click.
 */
export function EngineStatusWidget({
  adminToken: tokenOverride,
  forceOpen,
  onOpenChange,
}: EngineStatusWidgetProps = {}) {
  const [token, setToken] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<EngineBudgetSnapshot | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Resolve token once on mount + when storage changes (admin login flow).
  useEffect(() => {
    if (tokenOverride !== undefined) {
      setToken(tokenOverride);
      return;
    }
    setToken(readAdminToken());
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === ADMIN_TOKEN_STORAGE_KEY) setToken(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [tokenOverride]);

  // Allow parent to force-open the modal (hotkey "g e" lives in app/page.tsx).
  useEffect(() => {
    if (forceOpen) setModalOpen(true);
  }, [forceOpen]);

  // Notify parent when modal closes via Esc / backdrop.
  useEffect(() => {
    onOpenChange?.(modalOpen);
  }, [modalOpen, onOpenChange]);

  const refresh = useCallback(
    async (currentToken: string | null) => {
      if (!currentToken) return;
      setLoading(true);
      try {
        const res = await fetch("/api/admin/llm-budget", {
          headers: { Authorization: `Bearer ${currentToken}` },
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as ApiResponse;
        if (res.ok && payload.ok && payload.data) {
          setSnapshot(payload.data);
          setErrorReason(null);
        } else {
          setSnapshot(null);
          setErrorReason(payload.reason ?? `http_${res.status}`);
        }
      } catch (e) {
        setSnapshot(null);
        setErrorReason((e as Error).message || "network");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Poll while we have a token.
  useEffect(() => {
    if (!token) return;
    void refresh(token);
    const id = setInterval(() => void refresh(token), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, refresh]);

  // Non-admin sessions render nothing — keeps the widget invisible to
  // public visitors and screen-readers alike.
  if (!token) return null;

  const tone = snapshot ? toneFor(snapshot.health) : "text-text-muted";
  const used = snapshot?.forecastKey.used;
  const limit = snapshot?.forecastKey.limit ?? null;
  const balance = snapshot?.account.balance ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        title="Engine status · click for details · g e"
        className="group flex items-center gap-2 rounded-sm border border-bg-border bg-bg-elevated/40 px-2 py-0.5 font-mono text-2xs uppercase tracking-terminal hover:border-accent-cyan/40 hover:bg-bg-elevated/70"
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${
            snapshot
              ? snapshot.health === "green"
                ? "bg-accent-green animate-pulse-soft"
                : snapshot.health === "amber"
                ? "bg-accent-amber animate-pulse-soft"
                : snapshot.health === "red"
                ? "bg-accent-red animate-pulse-soft"
                : "bg-text-muted"
              : "bg-text-muted"
          }`}
        />
        <span className="text-text-muted">Forecast Engine</span>
        {snapshot ? (
          <>
            <span className={`num ${tone}`}>
              {formatUsd(used)}
              {limit !== null ? ` / ${formatUsd(limit)}` : ""}
            </span>
            <span className="text-text-faint">·</span>
            <span className="text-text-muted">acct</span>
            <span className={`num ${tone}`}>{formatUsd(balance)}</span>
          </>
        ) : errorReason ? (
          <span className="text-text-faint">n/a</span>
        ) : (
          <span className="text-text-faint">loading…</span>
        )}
        {loading && (
          <span aria-hidden className="text-accent-cyan/60">
            ◌
          </span>
        )}
      </button>

      {modalOpen && (
        <EngineStatusModal
          snapshot={snapshot}
          errorReason={errorReason}
          loading={loading}
          onRefresh={() => void refresh(token)}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
