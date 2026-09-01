import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { verifyInviteToken } from "@/lib/auth/invite-token";
import { AcceptInviteForm } from "./accept-invite-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const claims = verifyInviteToken(token);

  if (!claims) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="text-h2">Invite not valid</CardTitle>
          <CardDescription>
            This invite link is invalid or has expired. Ask your admin to send
            a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm underline underline-offset-4">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-h2">Join your team</CardTitle>
        <CardDescription>Set a password to activate your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptInviteForm token={token} />
      </CardContent>
    </Card>
  );
}
