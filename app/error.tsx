"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[radar/global-error]", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-6">
      <div className="w-full max-w-md rounded-sm border border-bg-border bg-bg-panel p-6">
        <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-accent-red">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-soft" />
          <span>RSG · Engine error</span>
        </div>
        <h1 className="mt-3 text-base font-semibold text-text-primary">
          Es ist etwas schiefgelaufen.
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Die Pipeline hat einen unerwarteten Fehler gemeldet. Versuche die Seite
          neu zu laden — die Datenquellen sind in der Regel nach wenigen
          Sekunden wieder erreichbar.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-text-faint">
            ref · {error.digest}
          </p>
        )}
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-sm border border-bg-border bg-bg-elevated px-3 py-1.5 font-mono text-2xs uppercase tracking-terminal text-text-primary hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            Erneut versuchen
          </button>
          <a
            href="/"
            className="rounded-sm border border-bg-border bg-bg-panel px-3 py-1.5 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            Zum Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
