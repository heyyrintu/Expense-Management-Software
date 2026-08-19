"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  createBudgetAction,
  deleteBudgetAction,
  updateBudgetAmountAction,
} from "./actions";

export type BudgetView = {
  id: string;
  scopeType: "department" | "project" | "category";
  label: string;
  period: "monthly" | "quarterly" | "yearly";
  /** Org base currency; `amount`/`spent` are integer minor units for <Amount>. */
  currency: string;
  amount: number;
  spent: number;
  pct: number;
  level: "ok" | "warn" | "over";
};

type Opt = { id: string; name: string };

// Status tokens, not palette colours — the same green/amber/red every other
// surface reads (§5.2). Spotted while fixing the bar's motion (D5.2).
const BAR_COLORS = {
  ok: "bg-status-success",
  warn: "bg-status-warning",
  over: "bg-status-danger",
};

export function BudgetsPanel({
  budgets,
  departments,
  projects,
  categories,
}: {
  budgets: BudgetView[];
  departments: Opt[];
  projects: Opt[];
  categories: Opt[];
}) {
  const router = useRouter();
  const [scopeType, setScopeType] = React.useState<BudgetView["scopeType"]>("category");
  const [scopeId, setScopeId] = React.useState("");
  const [period, setPeriod] = React.useState<BudgetView["period"]>("monthly");
  const [amount, setAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const options =
    scopeType === "department" ? departments : scopeType === "project" ? projects : categories;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
      } else {
        setAmount("");
        setScopeId("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4">
      {budgets.length > 0 ? (
        <ul className="grid gap-3">
          {budgets.map((b) => (
            <li key={b.id} className="grid gap-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {b.label}
                  <span className="text-muted-foreground font-normal">
                    {" "}· {b.scopeType} · {b.period}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {b.level === "warn" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      80% reached
                    </span>
                  ) : null}
                  {b.level === "over" ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Over budget
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1">
                    <Amount value={b.spent} currency={b.currency} size="meta" />
                    <span className="text-muted-foreground">/</span>
                    <Amount value={b.amount} currency={b.currency} />
                  </span>
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.min(b.pct, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${b.label} budget utilization ${b.pct}%`}
                className="bg-bg-subtle h-2 w-full overflow-hidden rounded-full"
              >
                {/* scaleX, not width (D5.2). This was `transition-all` over an
                    animated `width` — two violations of §4 principle 4 in one
                    line: width is a layout property, so every frame reflowed
                    the panel, and `transition-all` also animated the colour
                    the bar changes to when a budget tips into overspend. */}
                <div
                  className={cn(
                    "h-full w-full origin-left rounded-full",
                    "transition-transform duration-base ease-out",
                    BAR_COLORS[b.level]
                  )}
                  style={{ transform: `scaleX(${Math.min(b.pct, 100) / 100})` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">{b.pct}% used</span>
                <span className="flex gap-2">
                  <InlineAmount id={b.id} run={run} pending={pending} />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() => run(() => deleteBudgetAction({ id: b.id }))}
                  >
                    Delete
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="grid max-w-2xl gap-2 rounded-xl border p-4 sm:grid-cols-5 sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createBudgetAction({ scopeType, scopeId, period, amount }));
        }}
      >
        <div className="grid gap-1">
          <label htmlFor="b-scope" className="text-muted-foreground text-xs">Scope</label>
          <NativeSelect
            id="b-scope"
            value={scopeType}
            onChange={(e) => {
              setScopeType(e.target.value as BudgetView["scopeType"]);
              setScopeId("");
            }}
          >
            <option value="category">Category</option>
            <option value="department">Department</option>
            <option value="project">Project</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <label htmlFor="b-target" className="text-muted-foreground text-xs">Target</label>
          <NativeSelect id="b-target" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <label htmlFor="b-period" className="text-muted-foreground text-xs">Period</label>
          <NativeSelect id="b-period" value={period} onChange={(e) => setPeriod(e.target.value as BudgetView["period"])}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <label htmlFor="b-amount" className="text-muted-foreground text-xs">Amount</label>
          <Input
            id="b-amount"
            inputMode="decimal"
            placeholder="200000.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending || !scopeId || !amount}>
          {pending ? "Saving…" : "Add budget"}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-destructive text-sm">{error}</p>
      ) : null}
    </div>
  );
}

function InlineAmount({
  id,
  run,
  pending,
}: {
  id: string;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  pending: boolean;
}) {
  const [value, setValue] = React.useState("");
  return (
    <span className="flex items-center gap-1">
      <label htmlFor={`amt-${id}`} className="sr-only">New amount</label>
      <Input
        id={`amt-${id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="New amount"
        className="h-8 w-28"
        inputMode="decimal"
      />
      {value ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            run(() => updateBudgetAmountAction({ id, amount: value }));
            setValue("");
          }}
        >
          Save
        </Button>
      ) : null}
    </span>
  );
}
