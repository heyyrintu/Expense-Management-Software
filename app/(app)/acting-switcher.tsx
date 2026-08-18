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

  if (actingAs) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
        Acting as {actingAs.name}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1 text-xs"
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
      className="h-8 w-36 text-xs"
      disabled={pending}
    >
      <option value="">Act as…</option>
      {principals.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </NativeSelect>
  );
}
