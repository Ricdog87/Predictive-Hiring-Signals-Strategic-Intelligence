export function Header() {
  return (
    <header className="border-b border-bg-border bg-bg-panel/60 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-cyan/10 ring-1 ring-accent-cyan/40">
            <span className="text-accent-cyan font-mono text-sm">RSG</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">
              Predictive Hiring Radar
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
              Strategic Intelligence · v0.1 MVP
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="hidden sm:inline">Mock data · no external APIs</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-bg-border bg-bg-elevated px-2.5 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green" />
            Live preview
          </span>
        </div>
      </div>
    </header>
  );
}
