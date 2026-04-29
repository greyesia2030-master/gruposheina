import { SkeletonCard } from "@/components/ui/loading";

function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />;
}

export default function OperadorDashboardLoading() {
  return (
    <div className="max-w-3xl">
      <Skel className="mb-2 h-9 w-64" />
      <Skel className="mb-8 h-4 w-48" />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Skel className="mb-3 h-4 w-32" />
          <SkeletonCard />
        </div>
        <div>
          <Skel className="mb-3 h-4 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
