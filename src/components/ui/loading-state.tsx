import { cn } from "@/lib/utils";

export function Spinner({
  className,
  label = "Memuat data",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className="inline-flex items-center">
      <span
        className={cn(
          "h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-brand",
          className,
        )}
      />
    </span>
  );
}

export function LoadingState({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-ink-muted">
      <Spinner />
      {label}
    </div>
  );
}

/** Skeleton sederhana untuk tabel yang padat informasi. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4">
          <div className="h-3.5 w-24 animate-pulse rounded bg-[#eef0f3]" />
          <div className="h-3.5 flex-1 animate-pulse rounded bg-[#eef0f3]" />
          <div className="h-3.5 w-32 animate-pulse rounded bg-[#eef0f3]" />
          <div className="h-3.5 w-20 animate-pulse rounded bg-[#eef0f3]" />
        </div>
      ))}
    </div>
  );
}
