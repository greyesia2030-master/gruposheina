function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />;
}

export default function MiPortalPedidosLoading() {
  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Skel className="h-8 w-36" />
        <Skel className="h-9 w-32 rounded-lg" />
      </div>

      {/* Order cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skel className="h-5 w-40" />
                <Skel className="h-3 w-24" />
              </div>
              <Skel className="h-6 w-20 rounded-full" />
            </div>
            <div className="mt-3 flex items-center gap-4">
              <Skel className="h-3 w-20" />
              <Skel className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
