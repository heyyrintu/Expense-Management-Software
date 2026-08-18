export default function UsersLoading() {
  return (
    <div className="grid animate-pulse gap-4">
      <div className="bg-muted h-6 w-32 rounded" />
      <div className="bg-muted h-9 w-full max-w-xl rounded" />
      <div className="bg-muted h-64 rounded-xl" />
    </div>
  );
}
