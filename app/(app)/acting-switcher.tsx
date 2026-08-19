"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { setActingAction } from "@/app/(app)/settings/delegations/actions";

export function ActingSwitcher({
  principals,
  actingAs,
}: {
  principals: Array<{ id: string; name: string }>;
  actingAs: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function switchTo(principalId: string) {
    startTransition(async () => {
      await setActingAction({ principalId });
      router.refresh();
    });
  }

  // Acting on someone else's behalf is a state you must not be able to
  // forget you're in — warning tokens, read from the token layer rather than
  // hand-picked, and always visible in the top bar. (D0.4 restyle; the
  // behaviour is untouched.)
  if (actingAs) {
    return (
      <div className="bg-status-warning-subtle text-status-warning-text hidden items-center gap-1 rounded-md px-2 py-1 text-meta sm:flex">
        <span className="truncate">Acting as {actingAs.name}</span>
        <Button
          size="sm"
          variant="ghost"
          className="text-meta"
          disabled={pending}
          onClick={() => switchTo("")}
        >
          Switch back
        </Button>
      </div>
    );
  }
  if (principals.length === 0) return null;
  return (
    <NativeSelect
      aria-label="Act on behalf of"
      value=""
      onChange={(e) => e.target.value && switchTo(e.target.value)}
      className="hidden w-40 text-label sm:block"
      disabled={pending}
    >
      <option value="">Act as…</option>
      {principals.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </NativeSelect>
  );
}
