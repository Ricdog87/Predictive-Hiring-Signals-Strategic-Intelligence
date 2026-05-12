"use client";

import { useEffect, useState } from "react";
import { DATA_SOURCES, PRIMARY_NAV, type TabId } from "@/lib/uiMockData";
import type { SessionUser } from "@/lib/session";
import { useWatchlist } from "@/lib/watchlist";
import type { CompanyView } from "@/lib/marketView";

interface IntelligenceSidebarProps {
  user?: SessionUser;
  companies?: CompanyView[];
  activeTab?: TabId;
  onSwitchTab?: (id: TabId) => void;
  onSelectCompany?: (companyId: string) => void;
  onOpenPalette?: () => void;
}

export function IntelligenceSidebar({
  user,
  companies = [],
  activeTab,
  onSwitchTab,
  onSelectCompany,
  onOpenPalette,
}: IntelligenceSidebarProps = {}) {
  const { pinned, toggle } = useWatchlist();
  const watchlistCompanies = pinned
    .map((id) => companies.find((c) => c.id === id))
    .filter((c): c is CompanyView => Boolean(c));

  // Mobile drawer state — lg+ ignores it, the aside is permanent.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll when the drawer is open on mobile.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [mobileOpen]);

  // Esc closes the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const handleSelectCompany = (id: string) => {
    onSelectCompany?.(id);
    setMobileOpen(false);
  };

  const handleSwitchTab = (id: TabId) => {
    onSwitchTab?.(id);
    setMobileOpen(false);
  };

  const handleOpenPalette = () => {
    onOpenPalette?.();
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile trigger — fixed, lg+ hides it. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        className="fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-bg-border bg-bg-panel/95 shadow-lg backdrop-blur lg:hidden"
      >
        <span className="font-mono text-base text-text-primary">≡</span>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-bg-base/70 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={[
          "flex w-[236px] shrink-0 flex-col border-r border-bg-border bg-bg-surface",
          // Desktop: static, always shown.
          "lg:static lg:translate-x-0",
          // Mobile: fixed drawer, off-screen unless open.
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
        aria-hidden={!mobileOpen ? undefined : false}
      >
        <div className="flex h-12 items-center justify-between gap-2.5 border-b border-bg-border px-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-sm bg-accent-cyan/10 ring-1 ring-accent-cyan/40">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-accent-cyan">
                RSG
              </span>
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent-green" />
            </div>
            <div className="leading-tight">
              <div className="text-[12px] font-semibold text-text-primary">
                Hiring Radar
              </div>
              <div className="label-eyebrow">Intelligence Terminal</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-bg-border text-text-secondary hover:text-accent-cyan lg:hidden"
          >
            ×
          </button>
        </div>

        {user && (
          <div className="border-b border-bg-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent-cyan/10 font-mono text-2xs font-semibold text-accent-cyan ring-1 ring-accent-cyan/30">
                {user.initials}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[12px] font-medium text-text-primary">
                  {user.fullName}
                </div>
                <div className="label-eyebrow flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-accent-green animate-pulse-soft" />
                  <span className="truncate">online</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <SectionHeader label="Workspace" />
          <ul className="space-y-0.5">
            {PRIMARY_NAV.filter((n) => n.id !== "strategy-lab").map((n) => {
              const isActive = activeTab === n.id;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleSwitchTab(n.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={`group flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-[12.5px] transition-colors ${
                      isActive
                        ? "bg-accent-cyan/10 text-accent-cyan"
                        : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                    }`}
                    title={n.hint}
                  >
                    <span
                      className={`font-mono text-[12px] ${
                        isActive ? "text-accent-cyan" : "text-text-muted"
                      }`}
                    >
                      {n.glyph}
                    </span>
                    <span className="flex-1 text-left">{n.label}</span>
                    {n.chord && (
                      <span className="font-mono text-[10px] text-text-faint">
                        {n.chord}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 px-2">
            <button
              type="button"
              onClick={() => handleSwitchTab("strategy-lab")}
              aria-current={activeTab === "strategy-lab" ? "true" : undefined}
              className={`group flex w-full items-center justify-between rounded-sm border px-2 py-1.5 text-left text-[12px] transition-colors ${
                activeTab === "strategy-lab"
                  ? "border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan"
                  : "border-accent-cyan/30 bg-accent-cyan/5 text-accent-cyan hover:bg-accent-cyan/15"
              }`}
              title="Multi-Agent Strategie-Lab · konsolidierter Vorstands-Brief für DACH-Recruiter · g l"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className="font-mono text-[12px]">⌬</span>
                <span>Strategy Lab</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-accent-cyan/70">
                  Pro
                </span>
                <span className="hidden font-mono text-[10px] text-text-faint lg:inline">
                  g l
                </span>
              </span>
            </button>
          </div>

          {onOpenPalette && (
            <div className="mt-3 px-2">
              <button
                type="button"
                onClick={handleOpenPalette}
                className="flex w-full items-center justify-between rounded-sm border border-bg-border bg-bg-elevated/40 px-2 py-1.5 text-left text-[12px] text-text-secondary hover:border-accent-cyan/40 hover:text-text-primary transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-text-muted">⌕</span>
                  <span>Quick search</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="kbd">⌘</span>
                  <span className="kbd">K</span>
                </span>
              </button>
            </div>
          )}

          <div className="mt-5">
            <SectionHeader
              label="Watchlist"
              right={`${watchlistCompanies.length}`}
            />
            {watchlistCompanies.length === 0 ? (
              <div className="px-2 py-1 font-mono text-2xs uppercase tracking-terminal text-text-muted">
                pin companies via the ★ button
              </div>
            ) : (
              <ul className="space-y-0.5">
                {watchlistCompanies.map((c) => (
                  <li
                    key={c.id}
                    className="group flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-bg-elevated"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectCompany(c.id)}
                      className="flex flex-1 items-center justify-between text-left"
                      title={c.industry}
                    >
                      <span className="truncate text-[12px] text-text-secondary group-hover:text-text-primary">
                        {c.name}
                      </span>
                      <span
                        className={`num text-[11px] font-semibold ${
                          c.hiringScore >= 70
                            ? "text-accent-green"
                            : c.hiringScore >= 50
                            ? "text-accent-cyan"
                            : "text-text-muted"
                        }`}
                      >
                        {Math.round(c.hiringScore)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="text-accent-amber hover:text-accent-red"
                      title="Unpin"
                      aria-label="Unpin"
                    >
                      ★
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5">
            <SectionHeader
              label="Data Sources"
              right={`${DATA_SOURCES.length}`}
            />
            <ul className="space-y-0.5">
              {DATA_SOURCES.map((s) => (
                <li
                  key={s.id}
                  className="rounded-sm px-2 py-1 hover:bg-bg-elevated"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot status={s.status} />
                      <span className="text-[12px] text-text-secondary">
                        {s.label}
                      </span>
                    </div>
                    <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                      {s.status}
                    </span>
                  </div>
                  <div className="ml-4 flex items-center justify-between font-mono text-2xs text-text-faint">
                    <span>{s.lastSync}</span>
                    <span>{s.throughput}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5">
            <SectionHeader label="Confidence Tiers" />
            <ul className="space-y-1 px-2">
              <ConfidenceLegend label="High" range="≥ 80%" tone="bg-accent-green" />
              <ConfidenceLegend label="Medium" range="50–79%" tone="bg-accent-cyan" />
              <ConfidenceLegend label="Low" range="< 50%" tone="bg-accent-amber" />
            </ul>
          </div>

          <div className="mt-5">
            <SectionHeader label="Score Bands" />
            <ul className="space-y-1 px-2">
              <ConfidenceLegend label="Critical" range="80–100" tone="bg-accent-violet" />
              <ConfidenceLegend label="Strong" range="65–79" tone="bg-accent-cyan" />
              <ConfidenceLegend label="Moderate" range="45–64" tone="bg-accent-amber" />
              <ConfidenceLegend label="Weak" range="0–44" tone="bg-text-muted" />
            </ul>
          </div>
        </nav>

        <div className="border-t border-bg-border p-3">
          <div className="rounded-sm border border-bg-border bg-bg-panel p-2.5">
            <div className="label-eyebrow flex items-center justify-between">
              <span>Engine</span>
              <span className="flex items-center gap-1.5 text-accent-green">
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent-green" />
                Online
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <div className="label-eyebrow">Latency</div>
                <div className="num text-text-primary">42ms</div>
              </div>
              <div>
                <div className="label-eyebrow">Build</div>
                <div className="num text-text-primary">v0.2.0</div>
              </div>
            </div>
            <div className="mt-2 border-t border-bg-border pt-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
              RSG Engine · v1.0
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function SectionHeader({
  label,
  right,
}: {
  label: string;
  right?: string;
}) {
  return (
    <div className="label-eyebrow flex items-center justify-between px-2 pb-1.5">
      <span>{label}</span>
      {right && <span className="text-text-faint">{right}</span>}
    </div>
  );
}

function ConfidenceLegend({
  label,
  range,
  tone,
}: {
  label: string;
  range: string;
  tone: string;
}) {
  return (
    <li className="flex items-center justify-between text-[11px]">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
        <span className="text-text-secondary">{label}</span>
      </div>
      <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
        {range}
      </span>
    </li>
  );
}

function StatusDot({
  status,
}: {
  status: "live" | "pending" | "idle" | "mock" | "down";
}) {
  const color =
    status === "live"
      ? "bg-accent-green"
      : status === "pending"
      ? "bg-accent-cyan"
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
