"use client";

// Mobile-first capture form (ui-screen skill): full-width fields, native
// date + select inputs, pending state, inline server errors.
import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Result } from "@/lib/errors";
import { expenseInputSchema, type ExpenseInput } from "@/lib/schemas/expense";
import { deleteExpenseAction } from "./actions";

export type Option = { id: string; name: string };

export function ExpenseForm({
  defaults,
  categories,
  projects,
  currency,
  action,
  expenseId,
}: {
  defaults: ExpenseInput;
  categories: Option[];
  projects: Option[];
  currency: string;
  action: (input: ExpenseInput) => Promise<Result | Result<{ id: string }>>;
  expenseId?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseInputSchema) as Resolver<ExpenseInput>,
    defaultValues: defaults,
  });

  function onSubmit(values: ExpenseInput) {
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
    setServerError(null);
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
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid max-w-md gap-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount ({currency})</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="500.00" {...field} />
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
        <FormField
          control={form.control}
          name="merchant"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Merchant</FormLabel>
              <FormControl>
                <Input placeholder="Uber, Taj Mahal Hotel…" {...field} />
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
                <Input placeholder="Client dinner with…" {...field} />
              </FormControl>
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
            {pending ? "Saving…" : expenseId ? "Save expense" : "Add expense"}
          </Button>
          {expenseId ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={pending}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
