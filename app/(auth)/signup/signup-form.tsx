"use client";

import { signupAction } from "../actions";
import { signupSchema } from "@/lib/schemas/auth";
import { AuthForm } from "../components/auth-form";

export function SignupForm() {
  return (
    <AuthForm
      schema={signupSchema}
      defaults={{ orgName: "", slug: "", name: "", email: "", password: "" }}
      submitLabel="Create organization"
      action={signupAction}
      fields={[
        { name: "orgName", label: "Organization name", placeholder: "Acme Inc." },
        { name: "slug", label: "Workspace URL", placeholder: "acme" },
        { name: "name", label: "Your name", autoComplete: "name" },
        { name: "email", label: "Work email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
      ]}
    />
  );
}
