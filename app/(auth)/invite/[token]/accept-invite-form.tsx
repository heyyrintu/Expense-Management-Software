"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";

import { acceptInviteAction } from "../../actions";
import { AuthForm } from "../../components/auth-form";

const passwordOnlySchema = z.object({
  password: z.string().min(8, "At least 8 characters"),
});

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  return (
    <AuthForm
      schema={passwordOnlySchema}
      defaults={{ password: "" }}
      submitLabel="Activate account"
      action={(values) => acceptInviteAction({ token, ...values })}
      onSuccess={() => router.push("/login?activated=1")}
      fields={[
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "new-password",
        },
      ]}
    />
  );
}
