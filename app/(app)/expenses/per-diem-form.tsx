"use client";

// Per-diem capture — the §7.1 shell with the same substitution mileage makes:
// the thing you enter is not money, and the amount below it is READ-ONLY,
// derived by the server. You cannot type it, because a field that looks
// editable and isn't is worse than no field.
//
// The preview calls `planPerDiem` — the SAME function the server action calls
// — so the figure on screen and the figure written to the database are one
// piece of arithmetic, not two that agree until they don't.
import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SavedIndicator } from "@/components/ui/saved-indicator";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import {
  describeDays,
  planPerDiem,
  type PerDiemRateRow,
} from "@/lib/domain/per-diem";
import type { Result } from "@/lib/errors";
import { perDiemInputSchema, type PerDiemInput } from "@/lib/schemas/expense";
import { deleteExpenseAction } from "./actions";
import type { Option } from "./expense-form";

/** Serialisable rate version — dates cross the server/client boundary as ISO
 *  strings and are parsed back here, never pre-formatted (D1.1). */
export type PerDiemRateOption = {
  id: string;
  name: string;
  location: string | null;
  dailyAmount: number;
  effectiveFrom: string;
  active: boolean;
};

function toRows(options: PerDiemRateOption[]): PerDiemRateRow[] {
  return options.map((o) => ({
    id: o.id,
    name: o.name,
    location: o.location,
    dailyAmount: o.dailyAmount,
    effectiveFrom: new Date(o.effectiveFrom),
    active: o.active,
  }));
}

export function PerDiemForm({
  defaults,
  categories,
  projects,
  currency,
  rates,
  action,
  expenseId,
}: {
  defaults: PerDiemInput;
  categories: Option[];
  projects: Option[];
  currency: string;
  rates: PerDiemRateOption[];
  action: (input: PerDiemInput) => Promise<Result | Result<{ id: string }>>;
  expenseId?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();
  const form = useForm<PerDiemInput>({
    resolver: zodResolver(perDiemInputSchema) as Resolver<PerDiemInput>,
    defaultValues: defaults,
  });

  const rows = React.useMemo(() => toRows(rates), [rates]);
  // Distinct allowance names — a reader picks an allowance, not a historical
  // version of one. Which version applies is the server's job, from the date.
  const names = React.useMemo(
    () => [...new Set(rates.filter((r) => r.active).map((r) => r.name))].sort(),
    [rates]
  );

  const rateName = form.watch("rateName");
  const start = form.watch("start");
  const end = form.watch("end");
  const firstDayHalf = form.watch("firstDayHalf");
  const lastDayHalf = form.watch("lastDayHalf");

  const preview = React.useMemo(() => {
    if (!rateName || !start || !end) return null;
    const s = new Date(`${start}T00:00:00.000Z`);
    const e = new Date(`${end}T00:00:00.000Z`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    return planPerDiem(rows, {
      rateName,
      start: s,
      end: e,
      firstDayHalf,
      lastDayHalf,
    });
  }, [rows, rateName, start, end, firstDayHalf, lastDayHalf]);

  const priced = preview && !("error" in preview) ? preview : null;

  function onSubmit(values: PerDiemInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        setServerError(result.error);
      } else {
        setSavedAt(Date.now());
        router.push("/expenses");
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!expenseId) return;
    startTransition(async () => {
      const res = await deleteExpenseAction({ id: expenseId });
      if (!res.ok) setServerError(res.error);
      else {
        router.push("/expenses");
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-lg gap-5">
        <FormField
          control={form.control}
          name="rateName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Allowance</FormLabel>
              <FormControl>
                <NativeSelect {...field}>
                  <option value="">Select an allowance…</option>
                  {names.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
              </FormControl>
              <FormDescription>
                The rate in force on your start date is the one applied.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="start"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First day</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last day</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* The half-day rule, offered exactly where it applies — only the
            first and last day can be half, so there are exactly two boxes.
            A free "number of days" field would let someone claim 3.5 days
            without saying which half-day they mean. */}
        <fieldset className="border-line grid gap-3 rounded-lg border p-4">
          <legend className="text-label text-text-secondary px-1">
            Travel days
          </legend>
          <FormField
            control={form.control}
            name="firstDayHalf"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                </FormControl>
                <FormLabel className="font-normal">
                  First day is a half day
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastDayHalf"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                </FormControl>
                <FormLabel className="font-normal">
                  Last day is a half day
                </FormLabel>
              </FormItem>
            )}
          />
          <p className="text-meta text-text-tertiary">
            A one-day claim with either box ticked counts as half a day.
          </p>
        </fieldset>

        {/* Read-only, and visibly so: the server multiplies the rate by the
            day count, and this is a preview of that, not an input. */}
        <div className="border-line bg-bg-subtle grid gap-1 rounded-lg p-4" aria-live="polite">
          <span className="text-label text-text-secondary">Amount</span>
          {names.length === 0 ? (
            <span className="text-body text-status-danger-text">
              No per-diem rates configured — ask a finance admin to add one in
              Settings.
            </span>
          ) : priced ? (
            <>
              <Amount value={priced.amount} currency={currency} size="display" />
              <span className="text-meta text-text-tertiary">
                {describeDays(priced.halfDays)}
                {" × "}
                <Amount
                  value={priced.dailyAmount}
                  currency={currency}
                  size="meta"
                  tone="muted"
                />
                {" per day — calculated on save"}
              </span>
            </>
          ) : (
            <>
              <Amount value={null} currency={currency} size="display" />
              <span className="text-meta text-text-tertiary">
                {preview && "error" in preview
                  ? preview.error
                  : "Pick an allowance and both dates."}
              </span>
            </>
          )}
        </div>

        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <NativeSelect {...field}>
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project (optional)</FormLabel>
              <FormControl>
                <NativeSelect {...field}>
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="purpose"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purpose (optional)</FormLabel>
              <FormControl>
                <Input placeholder="Client workshop — Mumbai" {...field} />
              </FormControl>
              <FormDescription>Where were you, and why?</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError ? (
          <p role="alert" className="text-status-danger-text text-body">
            {serverError}
          </p>
        ) : null}
        {expenseId ? (
          <div>
            <Button type="button" variant="ghost" onClick={onDelete} disabled={pending}>
              Delete expense
            </Button>
          </div>
        ) : null}
        <StickyActionBar status={<SavedIndicator savedAt={savedAt} />}>
          <Button type="submit" loading={pending} disabled={names.length === 0}>
            {expenseId ? "Save expense" : "Add per diem"}
          </Button>
        </StickyActionBar>
      </form>
    </Form>
  );
}
