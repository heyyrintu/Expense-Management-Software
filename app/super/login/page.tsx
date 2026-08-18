import { SuperLoginForm } from "./super-login-form";

export default function SuperLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100">
        <h1 className="mb-1 text-xl font-semibold">Platform administration</h1>
        <p className="mb-4 text-sm text-zinc-400">Internal access only.</p>
        <SuperLoginForm />
      </div>
    </main>
  );
}
