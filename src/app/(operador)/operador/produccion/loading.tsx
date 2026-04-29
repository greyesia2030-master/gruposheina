import { SkeletonTable } from "@/components/ui/loading";

function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />;
}

export default function ProduccionLoading() {
  return (
    <div className="max-w-3xl">
      <Skel className="mb-2 h-8 w-44" />
      <Skel className="mb-6 h-4 w-32" />
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
