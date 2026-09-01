import { BrandMark } from "@/components/shell/brand-mark";

/**
 * Auth shell (N4.1) — the pediment composition, the app's one ornamental
 * moment (DESIGN-PLAN-NEOCLASSICAL §6): the receipt-fold mark, the wordmark
 * set in Bodoni Moda (the display face's third and final jurisdiction), and
 * a short gilt rule beneath it — gilt's third and final sanctioned use.
 * Everything below the pediment is the ordinary quiet system: a white card,
 * one laurel button.
 *
 * The pediment lives in the layout so login, signup, invites and the auth
 * error screen all stand under the same architrave. It is decorative to a
 * screen reader (the mark is aria-hidden; the wordmark is a paragraph, not
 * a heading) — each card keeps its own semantic heading.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-subtle/40 p-4">
      <div className="grid w-full max-w-sm gap-6">
        <header className="grid justify-items-center gap-3">
          <BrandMark className="size-9" />
          <p className="font-display text-h1 text-text-primary">Expense Management</p>
          <span aria-hidden="true" className="bg-gilt h-0.5 w-12 rounded-full" />
        </header>
        {children}
      </div>
    </main>
  );
}
