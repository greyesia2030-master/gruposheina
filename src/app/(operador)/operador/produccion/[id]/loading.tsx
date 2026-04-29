function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />;
}

export default function TicketDetailLoading() {
  return (
    <div className="max-w-xl">
      {/* Breadcrumb */}
      <Skel className="mb-6 h-4 w-24" />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-2">
          <Skel className="h-4 w-32" />
          <Skel className="h-8 w-56" />
          <Skel className="h-4 w-44" />
        </div>
        <Skel className="h-7 w-24 rounded-full" />
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-3 text-center">
            <Skel className="mx-auto mb-1 h-3 w-14" />
            <Skel className="mx-auto h-7 w-10" />
          </div>
        ))}
      </div>

      {/* Ingredients */}
      <Skel className="mb-2 h-4 w-40" />
      <Skel className="mb-2 h-3 w-64" />
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-stone-100 px-4 py-3 last:border-0">
            <div className="flex justify-between">
              <Skel className="h-4 w-32" />
              <Skel className="h-4 w-20" />
            </div>
            <Skel className="mt-1 h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Action button */}
      <Skel className="h-11 w-full rounded-xl" />
    </div>
  );
}
