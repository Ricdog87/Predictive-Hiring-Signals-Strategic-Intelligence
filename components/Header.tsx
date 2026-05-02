"use client";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-bg-border bg-bg-base/85 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-terminal text-text-muted">
            <span className="text-text-faint">RSG</span>
            <span className="text-text-faint">/</span>
            <span className="text-text-secondary">Intelligence</span>
            <span className="text-text-faint">/</span>
            <span className="text-accent-cyan">Hiring Radar</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 rounded-sm border border-bg-border bg-bg-panel px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-soft" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
              Mock dataset · live preview
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 font-mono text-[11px] text-text-secondary">
            <Stat label="UTC" value={timeStr()} />
            <span className="h-3 w-px bg-bg-rule" />
            <Stat label="REGION" value="GLOBAL" tone="cyan" />
            <span className="h-3 w-px bg-bg-rule" />
            <Stat label="MODEL" value="PHS v1.0" />
          </div>
          <button className="rounded-sm border border-bg-border bg-bg-panel px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-text-secondary hover:text-text-primary">
            ⌘K · Search
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-bg-border bg-bg-panel text-[11px] font-mono text-text-secondary">
            RD
          </div>
        </div>
      </div>

      <Ticker />
    </header>
  );
}

function timeStr() {
  const d = new Date();
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "cyan" | "green";
}) {
  const valueColor =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "green"
      ? "text-accent-green"
      : "text-text-primary";
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-2xs uppercase tracking-terminal text-text-muted">
        {label}
      </span>
      <span className={valueColor}>{value}</span>
    </span>
  );
}

const TICKER_ITEMS = [
  ["HELIX ROBOTICS", "PHS 84", "+38%"],
  ["VESPER HEALTH", "PHS 82", "+52%"],
  ["SKYFORGE AI", "PHS 91", "+60%"],
  ["RIVERMARK BIO", "PHS 78", "+41%"],
  ["QUANTA SECURE", "PHS 71", "+28%"],
  ["NORTHWIND PAY", "PHS 58", "+15%"],
  ["LUMEN COMMERCE", "PHS 31", "−12%"],
  ["PERISCOPE", "PHS 64", "+19%"],
];

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="relative overflow-hidden border-t border-bg-border bg-bg-surface">
      <div className="flex animate-ticker whitespace-nowrap py-1.5">
        {items.map(([name, score, delta], i) => {
          const positive = !delta.startsWith("−");
          return (
            <span
              key={i}
              className="mx-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider"
            >
              <span className="text-text-secondary">{name}</span>
              <span className="text-accent-cyan">{score}</span>
              <span
                className={positive ? "text-accent-green" : "text-accent-red"}
              >
                {delta}
              </span>
              <span className="text-text-faint">·</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
