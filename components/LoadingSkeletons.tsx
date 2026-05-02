"use client";

const shimmer =
  "relative overflow-hidden bg-bg-elevated/40 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent";

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-bg-border bg-bg-border md:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-bg-panel p-4">
          <div className={`h-2 w-20 rounded-sm ${shimmer}`} />
          <div className={`mt-3 h-7 w-16 rounded-sm ${shimmer}`} />
          <div className={`mt-2 h-2 w-14 rounded-sm ${shimmer}`} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className={`h-2.5 w-32 rounded-sm ${shimmer}`} />
        <div className={`h-2.5 w-16 rounded-sm ${shimmer}`} />
      </div>
      <div className="divide-rule">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-12 items-center gap-3 px-4 py-3"
          >
            <div className={`col-span-1 h-3 rounded-sm ${shimmer}`} />
            <div className="col-span-3 space-y-1.5">
              <div className={`h-3 w-3/4 rounded-sm ${shimmer}`} />
              <div className={`h-2 w-1/2 rounded-sm ${shimmer}`} />
            </div>
            <div className={`col-span-2 h-3 rounded-sm ${shimmer}`} />
            <div className={`col-span-2 h-2 rounded-full ${shimmer}`} />
            <div className={`col-span-1 h-3 rounded-sm ${shimmer}`} />
            <div className={`col-span-1 h-3 rounded-sm ${shimmer}`} />
            <div className={`col-span-2 h-3 rounded-sm ${shimmer}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InspectorSkeleton() {
  return (
    <div className="panel sticky top-[160px] h-fit">
      <div className="panel-header">
        <div className={`h-2.5 w-20 rounded-sm ${shimmer}`} />
        <div className={`h-2.5 w-12 rounded-sm ${shimmer}`} />
      </div>
      <div className="flex items-start gap-4 border-b border-bg-border p-5">
        <div className={`h-24 w-24 rounded-full ${shimmer}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-2 w-1/3 rounded-sm ${shimmer}`} />
          <div className={`h-5 w-3/4 rounded-sm ${shimmer}`} />
          <div className={`h-3 w-1/2 rounded-sm ${shimmer}`} />
        </div>
      </div>
      <div className="space-y-2 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-3 rounded-sm ${shimmer}`} />
        ))}
      </div>
    </div>
  );
}
