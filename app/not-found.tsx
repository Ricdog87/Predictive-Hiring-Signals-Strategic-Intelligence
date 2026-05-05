import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-6">
      <div className="w-full max-w-md rounded-sm border border-bg-border bg-bg-panel p-6">
        <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-accent-violet">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-violet animate-pulse-soft" />
          <span>RSG · 404 · off-radar</span>
        </div>
        <h1 className="mt-3 text-base font-semibold text-text-primary">
          Diese Seite gibt es nicht.
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Der Pfad wurde nicht gefunden — entweder vertippt, oder das Signal
          ist abgelaufen.
        </p>
        <div className="mt-5">
          <Link
            href="/"
            className="rounded-sm border border-bg-border bg-bg-elevated px-3 py-1.5 font-mono text-2xs uppercase tracking-terminal text-text-primary hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            ← Zum Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
