"use client";

interface TableEmptyStateProps {
  onClear?: () => void;
}

export function TableEmptyState({ onClear }: TableEmptyStateProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      <div className="relative flex flex-col items-center justify-center px-6 py-14">
        <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-bg-border bg-bg-surface font-mono text-lg text-text-muted">
          ∅
        </div>
        <div className="mt-3 font-mono text-2xs uppercase tracking-terminal text-text-muted">
          No companies match the active query
        </div>
        <div className="mt-1 max-w-sm text-center text-[12px] text-text-secondary">
          Try widening the score floor, removing a sector tag, or clearing the
          search box. The radar only shows companies with at least one tracked
          signal.
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="mt-4 rounded-sm border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1 font-mono text-2xs uppercase tracking-terminal text-accent-cyan hover:bg-accent-cyan/20"
          >
            ✕ Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

export function InspectorEmptyState() {
  return (
    <div className="panel sticky top-[160px] h-fit overflow-hidden">
      <div className="panel-header">
        <span className="label-eyebrow">Inspector</span>
        <span className="font-mono text-2xs text-text-faint">idle</span>
      </div>
      <div className="relative">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-50" />
        <div className="relative flex flex-col items-center justify-center px-6 py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-bg-border bg-bg-surface font-mono text-xl text-accent-cyan/60">
            ◎
          </div>
          <div className="mt-3 font-mono text-2xs uppercase tracking-terminal text-text-muted">
            Awaiting Selection
          </div>
          <p className="mt-2 max-w-[280px] text-center text-[12px] text-text-secondary">
            Click a row in the radar to inspect the score breakdown,
            confidence, predicted role clusters, and signal stream.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-t border-bg-border bg-bg-border">
        {["Hiring Score", "Confidence", "Forecast"].map((l) => (
          <div key={l} className="bg-bg-panel p-3">
            <div className="label-eyebrow">{l}</div>
            <div className="num mt-1 text-base text-text-faint">—</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelEmpty({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10">
      <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
        {title}
      </span>
      {hint && (
        <span className="mt-1 text-[12px] text-text-secondary">{hint}</span>
      )}
    </div>
  );
}
