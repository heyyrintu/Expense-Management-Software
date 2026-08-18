"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { createDelegationAction, deactivateDelegationAction } from "./actions";

type Opt = { id: string; name: string };

export function DelegationsPanel({
  delegations,
  users,
}: {
  delegations: Array<{ id: string; label: string }>;
  users: Opt[];
}) {
  const router = useRouter();
  const [delegateId, setDelegateId] = React.useState("");
  const [principalId, setPrincipalId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setDelegateId("");
        setPrincipalId("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid max-w-lg gap-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createDelegationAction({ delegateId, principalId }));
        }}
      >
        <div className="grid gap-1">
          <label htmlFor="d-delegate" className="text-muted-foreground text-xs">Delegate</label>
          <NativeSelect id="d-delegate" value={delegateId} onChange={(e) => setDelegateId(e.target.value)} className="w-44">
            <option value="">Select…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </NativeSelect>
        </div>
        <span className="text-muted-foreground pb-2 text-sm">acts for</span>
        <div className="grid gap-1">
          <label htmlFor="d-principal" className="text-muted-foreground text-xs">Principal</label>
          <NativeSelect id="d-principal" value={principalId} onChange={(e) => setPrincipalId(e.target.value)} className="w-44">
            <option value="">Select…</option>
            {users.filter((u) => u.id !== delegateId).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" disabled={pending || !delegateId || !principalId}>
          Add
        </Button>
      </form>

      {delegations.length === 0 ? (
        <p className="text-muted-foreground text-sm">No active delegations.</p>
      ) : (
        <ul className="grid gap-2">
          {delegations.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>{d.label}</span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={pending}
                onClick={() => run(() => deactivateDelegationAction({ id: d.id }))}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
