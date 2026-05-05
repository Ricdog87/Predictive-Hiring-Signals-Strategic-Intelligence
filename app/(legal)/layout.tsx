import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-base">
      <header className="border-b border-bg-border bg-bg-surface">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-5">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:text-accent-cyan"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent-cyan/10 font-mono text-[10px] font-semibold tracking-wider text-accent-cyan ring-1 ring-accent-cyan/40">
              RSG
            </span>
            <span>Hiring Radar</span>
          </Link>
          <nav className="flex items-center gap-3 font-mono text-2xs uppercase tracking-terminal">
            <Link
              href="/impressum"
              className="text-text-secondary hover:text-accent-cyan"
            >
              Impressum
            </Link>
            <Link
              href="/datenschutz"
              className="text-text-secondary hover:text-accent-cyan"
            >
              Datenschutz
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <article className="space-y-2 leading-relaxed text-text-primary">
          {children}
        </article>
      </main>
      <footer className="border-t border-bg-border bg-bg-surface">
        <div className="mx-auto flex h-10 max-w-3xl items-center justify-between px-5 font-mono text-2xs uppercase tracking-terminal text-text-muted">
          <span>RSG · Hiring Radar</span>
          <Link href="/" className="hover:text-accent-cyan">
            ← Zum Dashboard
          </Link>
        </div>
      </footer>
    </div>
  );
}
