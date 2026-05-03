"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-6">
      <div className="panel w-full max-w-xl p-6 text-center">
        <div className="font-mono text-2xs uppercase tracking-terminal text-accent-red">Dashboard unavailable</div>
        <h1 className="mt-2 text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-text-secondary">{error.message || "An unexpected runtime error occurred."}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-sm border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-2 font-mono text-2xs uppercase tracking-terminal text-accent-cyan hover:bg-accent-cyan/20"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
