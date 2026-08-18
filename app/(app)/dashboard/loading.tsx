export default function DashboardLoading() {
  return (
    <div className="grid animate-pulse gap-4">
      <div className="bg-muted h-8 w-64 rounded" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-muted h-28 rounded-xl" />
        <div className="bg-muted h-28 rounded-xl" />
      </div>
    </div>
  );
}
