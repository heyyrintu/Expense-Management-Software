import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSessionCtx } from "@/lib/auth/guard";
import { logoutAction } from "@/app/(auth)/actions";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getSessionCtx();
  if (!ctx) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-baseline gap-3">
            <span className="font-semibold">Expense Management</span>
            <span className="text-muted-foreground text-sm">/{ctx.orgSlug}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {ctx.role.replace("_", " ")}
            </span>
            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
