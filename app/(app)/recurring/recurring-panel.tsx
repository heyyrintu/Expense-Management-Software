"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  createTemplateAction,
  deleteTemplateAction,
  toggleTemplateAction,
} from "./actions";

export type TemplateView = {
  id: string;
  schedule: string;
  amount: string;
  merchant: string;
  category: string;
  active: boolean;
  lastRun: string | null;
};

type Opt = { id: string; name: string };

export function RecurringPanel({
  templates,
  categories,
}: {
  templates: TemplateView[];
  categories: Opt[];
}) {
  const router = useRouter();
  const [cadence, setCadence] = React.useState<"monthly" | "weekly">("monthly");
  const [day, setDay] = React.useState("1");
  const [amount, setAmount] = React.useState("");
  const [merchant, setMerchant] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setAmount("");
        setMerchant("");
        setPurpose("");
        router.refresh();
      }
    });
  }

  const dayOptions =
    cadence === "monthly"
      ? Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Day ${i + 1}` }))
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w, i) => ({
          value: String(i + 1),
          label: w,
        }));

  return (
    <div className="grid gap-4">
      <form
        className="grid max-w-2xl gap-3 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            createTemplateAction({ cadence, day, amount, categoryId, merchant, purpose })
          );
        }}
      >
        <h2 className="text-sm font-medium">New template</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1">
            <label htmlFor="rt-cadence" className="text-muted-foreground text-xs">Cadence</label>
            <NativeSelect
              id="rt-cadence"
              value={cadence}
              onChange={(e) => {
                setCadence(e.target.value as "monthly" | "weekly");
                setDay("1");
              }}
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor="rt-day" className="text-muted-foreground text-xs">Day</label>
            <NativeSelect id="rt-day" value={day} onChange={(e) => setDay(e.target.value)}>
              {dayOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor="rt-amount" className="text-muted-foreground text-xs">Amount</label>
            <Input id="rt-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="999.00" />
          </div>
          <div className="grid gap-1">
            <label htmlFor="rt-merchant" className="text-muted-foreground text-xs">Merchant</label>
            <Input id="rt-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Airtel Broadband" />
          </div>
          <div className="grid gap-1">
            <label htmlFor="rt-category" className="text-muted-foreground text-xs">Category</label>
            <NativeSelect id="rt-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor="rt-purpose" className="text-muted-foreground text-xs">Purpose (optional)</label>
            <Input id="rt-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Monthly internet" />
          </div>
        </div>
        {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
        <div>
          <Button type="submit" disabled={pending || !amount || !merchant || !categoryId}>
            {pending ? "Saving…" : "Add template"}
          </Button>
        </div>
      </form>

      {templates.length === 0 ? (
        <p className="text-muted-foreground text-sm">No templates yet.</p>
      ) : (
        <ul className="grid gap-2">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-medium">
                  {t.merchant}
                  {!t.active ? (
                    <span className="text-muted-foreground font-normal"> · paused</span>
                  ) : null}
                </span>
                <span className="text-muted-foreground">
                  {t.schedule} · {t.category}
                  {t.lastRun ? ` · last drafted ${t.lastRun}` : ""}
                </span>
              </span>
              <span className="font-semibold whitespace-nowrap">{t.amount}</span>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => toggleTemplateAction({ id: t.id }))}>
                {t.active ? "Pause" : "Resume"}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => run(() => deleteTemplateAction({ id: t.id }))}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
