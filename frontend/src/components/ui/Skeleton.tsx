import { cx } from "./cx";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("rounded bg-slate-200 motion-safe:animate-pulse", className)} />;
}

/** Rows shaped like a list of request cards. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 p-4">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 4, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-busy="true" className="rounded-lg border border-slate-200 bg-white">
      <div className="h-9 border-b border-slate-200 bg-slate-50" />
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid gap-4 border-b border-slate-200 px-4 py-3 last:border-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-5" />
          ))}
        </div>
      ))}
    </div>
  );
}
