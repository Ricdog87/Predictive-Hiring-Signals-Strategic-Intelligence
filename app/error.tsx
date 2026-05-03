'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="m-6 rounded border border-accent-red/50 bg-accent-red/[0.08] p-4 font-mono text-xs text-accent-red">
      <p className="mb-2 uppercase tracking-wider">Application error boundary</p>
      <p className="mb-3 break-all">{error.message}</p>
      <button type="button" onClick={() => reset()} className="rounded border border-accent-red/60 px-2 py-1 uppercase tracking-wider">
        Retry
      </button>
    </div>
  );
}
