import { SuperLoginForm } from "./super-login-form";

export default function SuperLoginPage() {
  return (
    <main className="bg-bg-app flex min-h-screen items-center justify-center p-4">
      <div className="border-line bg-bg-surface text-text-primary w-full max-w-sm rounded-lg border p-6">
        <h1 className="mb-1 text-xl font-semibold">Platform administration</h1>
        <p className="text-text-tertiary mb-4 text-sm">Internal access only.</p>
        <SuperLoginForm />
      </div>
    </main>
  );
}
