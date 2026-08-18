"use client";

// Mileage capture: distance × org rate, amount auto-calculated live.
import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

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
import type { Result } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-md gap-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="distanceKm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Distance (km)</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" placeholder="42" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
        </div>

        <div className="bg-muted/50 rounded-lg border p-3 text-sm" aria-live="polite">
          {ratePerKmMinor <= 0 ? (
            <span className="text-destructive">
              No mileage rate configured — ask a finance admin to set one in
              Settings.
            </span>
          ) : computed !== null ? (
            <>
              Amount:{" "}
              <span className="font-semibold">{formatMoney(computed, currency)}</span>{" "}
              <span className="text-muted-foreground">
                ({distanceRaw} km × {formatMoney(ratePerKmMinor, currency)}/km)
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Enter a distance to see the amount ({formatMoney(ratePerKmMinor, currency)}/km)
            </span>
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
                <Input placeholder="Client site visit — Whitefield" {...field} />
              </FormControl>
              <FormDescription>Where did you drive, and why?</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {serverError ? (
          <p role="alert" className="text-destructive text-sm">
            {serverError}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : expenseId ? "Save expense" : "Add mileage"}
          </Button>
          {expenseId ? (
            <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
              Delete
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
