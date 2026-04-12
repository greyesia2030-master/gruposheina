import type { CSSProperties } from "react";

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Loading({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

// ── Skeleton primitivo ────────────────────────────────────────────────────────

function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} style={style} />
  );
}

// ── Skeleton para una card ────────────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-8 w-1/2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

// ── Skeleton para una tabla ───────────────────────────────────────────────────

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {/* Header */}
      <div className="border-b border-border bg-surface-hover px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3" style={{ width: `${60 + (i % 3) * 20}px` }} />
          ))}
        </div>
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-4"
              style={{ width: `${50 + ((r + c) % 4) * 25}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Skeleton para un stat card (dashboard) ────────────────────────────────────

export function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-8 w-20" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}
