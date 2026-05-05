export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base">
      <div className="flex flex-col items-center gap-4 font-mono text-2xs uppercase tracking-terminal text-text-muted">
        <div className="relative h-10 w-10">
          <span className="absolute inset-0 rounded-full border border-bg-border" />
          <span className="absolute inset-0 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-soft" />
          <span>RSG · Hiring Radar wird geladen</span>
        </div>
      </div>
    </div>
  );
}
