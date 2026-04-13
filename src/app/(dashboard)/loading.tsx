export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-56 rounded-lg bg-gray-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-gray-200" />
    </div>
  );
}
