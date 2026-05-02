"use client";

const NAV = [
  { id: "radar", label: "Radar", glyph: "◎", active: true },
  { id: "companies", label: "Companies", glyph: "◫" },
  { id: "signals", label: "Signals", glyph: "≈" },
  { id: "timeline", label: "Timeline", glyph: "⌖" },
  { id: "flows", label: "Flows", glyph: "⇌" },
  { id: "scoring", label: "Scoring", glyph: "ƒ" },
];

const SOURCES = [
  { label: "LinkedIn Jobs", status: "live" },
  { label: "Crunchbase", status: "live" },
  { label: "Press / RSS", status: "live" },
  { label: "GitHub Orgs", status: "idle" },
  { label: "Hermes ingest", status: "mock" },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:flex w-[228px] shrink-0 flex-col border-r border-bg-border bg-bg-surface">
      <div className="flex h-14 items-center gap-2.5 border-b border-bg-border px-4">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-sm bg-accent-cyan/10 ring-1 ring-accent-cyan/40">
          <span className="font-mono text-[11px] font-semibold tracking-wider text-accent-cyan">
            RSG
          </span>
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent-green" />
        </div>
        <div className="leading-tight">
          <div className="text-[12px] font-semibold text-text-primary">
            Hiring Radar
          </div>
          <div className="label-eyebrow">Strategic Intel</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="label-eyebrow px-2 pb-2">Workspace</div>
        <ul className="space-y-0.5">
          {NAV.map((n) => (
            <li key={n.id}>
              <button
                className={`group flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] transition-colors ${
                  n.active
                    ? "bg-accent-cyan/10 text-accent-cyan"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                }`}
              >
                <span
                  className={`font-mono text-[13px] ${
                    n.active ? "text-accent-cyan" : "text-text-muted"
                  }`}
                >
                  {n.glyph}
                </span>
                <span className="flex-1 text-left">{n.label}</span>
                {n.active && (
                  <span className="h-1 w-1 rounded-full bg-accent-cyan" />
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <div className="label-eyebrow flex items-center justify-between px-2 pb-2">
            <span>Data Sources</span>
            <span className="text-text-faint">5</span>
          </div>
          <ul className="space-y-1">
            {SOURCES.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between px-2 py-1 text-[12px] text-text-secondary"
              >
                <div className="flex items-center gap-2">
                  <StatusDot status={s.status as Status} />
                  <span>{s.label}</span>
                </div>
                <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          <div className="label-eyebrow px-2 pb-2">Watchlists</div>
          <ul className="space-y-0.5">
            {[
              { name: "EU AI labs", count: 14 },
              { name: "Series B Fintech", count: 22 },
              { name: "Cyber unicorns", count: 9 },
            ].map((w) => (
              <li
                key={w.name}
                className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1 text-[12px] text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
              >
                <span>{w.name}</span>
                <span className="font-mono text-2xs text-text-muted">
                  {w.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-bg-border p-3">
        <div className="rounded-sm border border-bg-border bg-bg-panel p-2.5">
          <div className="label-eyebrow flex items-center justify-between">
            <span>System</span>
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
              <div className="num text-text-primary">v0.1.2</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

type Status = "live" | "idle" | "mock" | "down";

function StatusDot({ status }: { status: Status }) {
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
