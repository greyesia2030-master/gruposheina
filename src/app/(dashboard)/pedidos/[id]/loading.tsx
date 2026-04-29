import { SkeletonCard } from "@/components/ui/loading";

function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />;
}

export default function PedidoDetailLoading() {
  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <Skel className="mb-6 h-4 w-24" />

      {/* Title row */}
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-2">
          <Skel className="h-8 w-64" />
          <Skel className="h-4 w-40" />
        </div>
        <Skel className="h-7 w-24 rounded-full" />
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Order lines */}
      <Skel className="mb-3 h-5 w-32" />
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <Skel className="h-4 w-20" />
            <Skel className="h-4 w-36" />
            <Skel className="ml-auto h-4 w-10" />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Skel className="h-9 w-32 rounded-lg" />
        <Skel className="h-9 w-28 rounded-lg" />
      </div>
    </div>
  );
}
