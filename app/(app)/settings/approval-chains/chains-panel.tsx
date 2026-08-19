"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createApprovalRuleAction, deleteApprovalRuleAction } from "./actions";

export type RuleView = {
  id: string;
  name: string;
  department: string;
  /** Threshold in minor units; null means the rule applies to any amount. */
  aboveAmount: number | null;
  currency: string;
  approver: string;
  secondApprover: string | null;
};

type Opt = { id: string; name: string };

export function ChainsPanel({
  rules,
  departments,
  approvers,
}: {
  rules: RuleView[];
  departments: Opt[];
  approvers: Opt[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [aboveAmount, setAboveAmount] = React.useState("");
  const [approverId, setApproverId] = React.useState("");
  const [secondApproverId, setSecondApproverId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
      } else {
        setName("");
        setDepartmentId("");
        setAboveAmount("");
        setApproverId("");
        setSecondApproverId("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4">
      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No custom rules — default routing applies.
        </p>
      ) : (
        <ul className="grid gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <span className="grid">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">
                  {r.department} ·{" "}
                  {r.aboveAmount !== null ? (
                    <>
                      {"above "}
                      <Amount
                        value={r.aboveAmount}
                        currency={r.currency}
                        size="meta"
                        tone="muted"
                      />
                    </>
                  ) : (
                    "any amount"
                  )}{" "}
                  → {r.approver}
                  {r.secondApprover ? ` → ${r.secondApprover}` : ""}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={pending}
                onClick={() => run(() => deleteApprovalRuleAction({ id: r.id }))}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="grid max-w-2xl gap-3 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            createApprovalRuleAction({
              name,
              departmentId,
              aboveAmount,
              approverId,
              secondApproverId,
            })
          );
        }}
      >
        <h2 className="text-sm font-medium">New rule</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor="r-name" className="text-muted-foreground text-xs">Name</label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales big-ticket" />
          </div>
          <div className="grid gap-1">
            <label htmlFor="r-dept" className="text-muted-foreground text-xs">Department</label>
            <NativeSelect id="r-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor="r-amount" className="text-muted-foreground text-xs">Only above (optional)</label>
            <Input id="r-amount" inputMode="decimal" value={aboveAmount} onChange={(e) => setAboveAmount(e.target.value)} placeholder="25000.00" />
          </div>
          <div className="grid gap-1">
            <label htmlFor="r-approver" className="text-muted-foreground text-xs">Approver</label>
            <NativeSelect id="r-approver" value={approverId} onChange={(e) => setApproverId(e.target.value)}>
              <option value="">Select…</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor="r-second" className="text-muted-foreground text-xs">Second approver (optional)</label>
            <NativeSelect id="r-second" value={secondApproverId} onChange={(e) => setSecondApproverId(e.target.value)}>
              <option value="">None — org threshold applies</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
        <div>
          <Button type="submit" disabled={pending || !name || !approverId}>
            {pending ? "Saving…" : "Add rule"}
          </Button>
        </div>
      </form>
    </div>
  );
}
