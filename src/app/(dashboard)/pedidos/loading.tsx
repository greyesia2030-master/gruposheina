import { SkeletonTable } from "@/components/ui/loading";

export default function PedidosLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-28 animate-pulse rounded-md bg-gray-200" />
        <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {[80, 55, 100, 110, 60, 80, 90].map((w, i) => (
          <div key={i} className="px-4 py-2.5">
            <div className="h-4 animate-pulse rounded bg-gray-200" style={{ width: w }} />
          </div>
        ))}
      </div>

      <SkeletonTable rows={8} cols={7} />
    </div>
  );
}
