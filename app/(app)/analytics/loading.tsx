export default function AnalyticsLoading() {
  return (
    <div className="grid animate-pulse gap-4">
      <div className="bg-muted h-6 w-32 rounded" />
      <div className="bg-muted h-72 rounded-xl" />
      <div className="bg-muted h-40 rounded-xl" />
    </div>
  );
}
