import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-8 text-center">
      <div className="grid gap-3">
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist — or belongs to a
          different workspace.
        </p>
        <Link href="/dashboard" className="underline underline-offset-4">
          Back to your dashboard
        </Link>
      </div>
    </main>
  );
}
