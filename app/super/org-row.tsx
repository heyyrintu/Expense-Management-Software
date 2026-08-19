"use client";
import { DateCell } from "@/components/ui/date-cell";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { suspendOrgAction, unsuspendOrgAction } from "./actions";

export function OrgRow({
  org,
}: {
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    users: number;
    expenses: number;
    reports: number;
    storageMb: number;
    created: Date | string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const suspended = org.status === "suspended";

  function toggle() {
    startTransition(async () => {
      const fn = suspended ? unsuspendOrgAction : suspendOrgAction;
      await fn({ orgId: org.id });
      router.refresh();
    });
  }

  return (
    <tr className="border-t border-zinc-800">
      <td className="p-3">
        <span className="font-medium">{org.name}</span>{" "}
        <span className="text-zinc-500">/{org.slug} · {org.plan}</span>
      </td>
      <td className="p-3">{org.users}</td>
      <td className="p-3">{org.expenses}</td>
      <td className="p-3">{org.reports}</td>
      <td className="p-3">{org.storageMb} MB</td>
      <td className="p-3 whitespace-nowrap">
        <DateCell value={org.created} />
      </td>
      <td className="p-3">
        <span
          className={
            suspended
              ? "rounded-full bg-red-900/60 px-2 py-0.5 text-xs text-red-300"
              : "rounded-full bg-green-900/60 px-2 py-0.5 text-xs text-green-300"
          }
        >
          {org.status}
        </span>
      </td>
      <td className="p-3 text-right">
        <Button
          size="sm"
          variant={suspended ? "outline" : "destructive"}
          disabled={pending}
          onClick={toggle}
        >
          {pending ? "…" : suspended ? "Unsuspend" : "Suspend"}
        </Button>
      </td>
    </tr>
  );
}
