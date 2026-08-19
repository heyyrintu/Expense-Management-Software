"use client";

// Mileage capture — the §7.1 shell with one substitution: distance takes the
// amount field's place, and the amount below it is READ-ONLY, computed from
// the org rate. You cannot type it, because the server derives it; a field
// that looks editable and isn't is worse than no field.
//
// Same single column, same field order (distance → date → category → project
// → purpose), same sticky bar. D2.1 restyles; the schema and action are
// untouched.
import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
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
import type { Result } from "@/lib/errors";
import { mileageInputSchema, type MileageInput } from "@/lib/schemas/expense";
import { deleteExpenseAction } from "./actions";
import type { Option } from "./expense-form";

export function MileageForm({
  defaults,
  categories,
  projects,
  currency,
  ratePerKmMinor,
  action,
  expenseId,
}: {
  defaults: MileageInput;
  categories: Option[];
  projects: Option[];
  currency: string;
  ratePerKmMinor: number;
  action: (input: MileageInput) => Promise<Result | Result<{ id: string }>>;
  expenseId?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();
  const form = useForm<MileageInput>({
    resolver: zodResolver(mileageInputSchema) as Resolver<MileageInput>,
    defaultValues: defaults,
  });

  const distanceRaw = form.watch("distanceKm");
  const distance = /^[1-9]\d{0,4}$/.test(distanceRaw)
    ? Number.parseInt(distanceRaw, 10)
    : null;
  const computed =
    distance !== null && ratePerKmMinor > 0 ? distance * ratePerKmMinor : null;

  function onSubmit(values: MileageInput) {
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
      if (!res.ok) {
        setServerError(res.error);
      } else {
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
          name="distanceKm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Distance</FormLabel>
              <FormControl>
                {/* Display-size, like the amount field it stands in for — this
                    is the number the reader is here to enter. `numeric`, not
                    `decimal`: the schema takes whole kilometres. */}
                <div className="border-line-strong bg-bg-surface flex items-baseline gap-2 rounded-md border px-4 py-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-focus-ring focus-within:ring-offset-2 focus-within:ring-offset-bg-app transition-[border-color,box-shadow] duration-instant ease-out">
                  <input
                    inputMode="numeric"
                    type="text"
                    autoComplete="off"
                    placeholder="42"
                    className="amount text-display w-full min-w-0 bg-transparent text-right outline-none placeholder:font-normal placeholder:text-text-tertiary"
                    {...field}
                  />
                  <span aria-hidden="true" className="text-h3 text-text-tertiary">
                    km
                  </span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Read-only, and visibly so: the server multiplies distance by the
            org rate, and this is a preview of that, not an input. */}
        <div className="border-line bg-bg-subtle grid gap-1 rounded-lg p-4" aria-live="polite">
          <span className="text-label text-text-secondary">Amount</span>
          {ratePerKmMinor <= 0 ? (
            <span className="text-body text-status-danger-text">
              No mileage rate configured — ask a finance admin to set one in
              Settings.
            </span>
          ) : (
            <>
              <Amount value={computed} currency={currency} size="display" />
              <span className="text-meta text-text-tertiary">
                {computed !== null ? `${distanceRaw} km × ` : "Rate "}
                <Amount value={ratePerKmMinor} currency={currency} size="meta" tone="muted" />
                {" per km — calculated on save"}
              </span>
            </>
          )}
        </div>

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                <Input placeholder="Client site visit — Whitefield" {...field} />
              </FormControl>
              <FormDescription>Where did you drive, and why?</FormDescription>
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
          <Button type="submit" loading={pending}>
            {expenseId ? "Save expense" : "Add mileage"}
          </Button>
        </StickyActionBar>
      </form>
    </Form>
  );
}
