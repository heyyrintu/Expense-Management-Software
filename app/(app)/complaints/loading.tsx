export default function Loading() {
  return (
    <section className="grid gap-4">
      <div className="bg-muted h-6 w-48 animate-pulse rounded" />
      <div className="bg-muted h-20 animate-pulse rounded-lg" />
      <div className="bg-muted h-20 animate-pulse rounded-lg" />
    </section>
  );
}
