"use client";
import { DateCell } from "@/components/ui/date-cell";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
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
    <tr className="border-line border-t">
      <td className="p-3">
        <span className="font-medium">{org.name}</span>{" "}
        <span className="text-text-tertiary">/{org.slug} · {org.plan}</span>
      </td>
      <td className="p-3">{org.users}</td>
      <td className="p-3">{org.expenses}</td>
      <td className="p-3">{org.reports}</td>
      <td className="p-3">{org.storageMb} MB</td>
      <td className="p-3 whitespace-nowrap">
        <DateCell value={org.created} />
      </td>
      <td className="p-3">
        {/* active / suspended are both in STATUS_MAP — an org's state reads
            through the same badge as everything else, so "suspended" looks
            the same here as it does inside the tenant. */}
        <StatusBadge status={org.status} />
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
