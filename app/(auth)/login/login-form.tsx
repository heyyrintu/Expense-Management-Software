"use client";

import { loginAction } from "../actions";
import { loginSchema } from "@/lib/schemas/auth";
import { AuthForm } from "../components/auth-form";

export function LoginForm() {
  return (
    <AuthForm
      schema={loginSchema}
      defaults={{ slug: "", email: "", password: "" }}
      submitLabel="Sign in"
      action={loginAction}
      fields={[
        { name: "slug", label: "Organization", placeholder: "acme", autoComplete: "organization" },
        { name: "email", label: "Email", type: "email", placeholder: "you@company.com", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
    />
  );
}
