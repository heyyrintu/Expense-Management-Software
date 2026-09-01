import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionCtx } from "@/lib/auth/guard";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getSessionCtx()) redirect("/dashboard");
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-h2">Sign in</CardTitle>
        <CardDescription>
          Enter your organization and credentials.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <LoginForm />
        <p className="text-text-tertiary text-center text-sm">
          New organization?{" "}
          <Link href="/signup" className="underline underline-offset-4">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
