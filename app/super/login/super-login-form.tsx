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
        <label htmlFor="s-email" className="text-xs text-zinc-400">Email</label>
        <Input
          id="s-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-zinc-700 bg-zinc-800 text-zinc-100"
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor="s-password" className="text-xs text-zinc-400">Password</label>
        <Input
          id="s-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-zinc-700 bg-zinc-800 text-zinc-100"
        />
      </div>
      {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
