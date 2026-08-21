"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { superLoginAction } from "../actions";

export function SuperLoginForm() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await superLoginAction({ email, password });
          if (!res.ok) setError(res.error);
        });
      }}
    >
      <div className="grid gap-1">
        <label htmlFor="s-email" className="text-text-tertiary text-xs">Email</label>
        {/* No className: the Input primitive is already on the token layer,
            and overriding its surface here is what put zinc in this file. */}
        <Input
          id="s-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor="s-password" className="text-text-tertiary text-xs">Password</label>
        <Input
          id="s-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-status-danger-text text-sm">{error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
