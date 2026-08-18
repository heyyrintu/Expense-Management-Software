"use client";

// Mobile-first capture form (ui-screen skill): full-width fields, native
// date + select inputs, pending state, inline server errors.
import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";

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
import { FlagChips } from "@/components/flag-chips";
import type { Result } from "@/lib/errors";
import { expenseInputSchema, type ExpenseInput } from "@/lib/schemas/expense";
import { deleteExpenseAction, getFxRateAction } from "./actions";
import { usePolicyPreview } from "./use-policy-preview";
import { SUPPORTED_CURRENCIES } from "@/lib/fx";

export type Option = { id: string; name: string };
export type ClientOption = { id: string; name: string; code: string };

export type OcrSuggestion = {
  merchant?: string;
  /** yyyy-mm-dd */
  date?: string;
  /** decimal string, e.g. "500.00" */
  amount?: string;
};

export function ExpenseForm({
  defaults,
  categories,
  projects,
  clients = [],
  currency,
  action,
  expenseId,
  ocr,
  receiptCount = 0,
}: {
  defaults: ExpenseInput;
  categories: Option[];
  projects: Option[];
  clients?: ClientOption[];
  currency: string;
  action: (input: ExpenseInput) => Promise<Result | Result<{ id: string }>>;
  expenseId?: string;
  ocr?: OcrSuggestion;
  receiptCount?: number;
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

  const splitArray = useFieldArray({ control: form.control, name: "splits" });
  const selCurrency = form.watch("currency");
  const fxRate = form.watch("fxRate");
  const isForeign = selCurrency !== currency;
  React.useEffect(() => {
    if (!isForeign) {
      form.setValue("fxRate", "1");
      return;
    }
    let cancelled = false;
    void getFxRateAction({ currency: selCurrency }).then((res) => {
      if (!cancelled && res.ok && res.data.rate) {
        form.setValue("fxRate", res.data.rate, { shouldDirty: true });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selCurrency, isForeign]);
  const billable = form.watch("billable");
  const watchedSplits = form.watch("splits");
  const watchedAmount = form.watch("amount");
  const splitTotal = (watchedSplits ?? []).reduce((sum, s) => {
    const v = Number.parseFloat(s?.value || "0");
    return sum + (Number.isFinite(v) ? Math.round(v * 100) : 0);
  }, 0);
  const amountMinor = (() => {
    const v = Number.parseFloat(watchedAmount || "0");
    return Number.isFinite(v) ? Math.round(v * 100) : 0;
  })();
  const splitsMatch = (watchedSplits?.length ?? 0) === 0 || splitTotal === amountMinor;

  const watched = form.watch(["amount", "date", "merchant", "categoryId"]);
  const liveFlags = usePolicyPreview({
    amount: watched[0],
    date: watched[1],
    merchant: watched[2],
    categoryId: watched[3],
    expenseId,
    receiptCount,
  });

  const hasOcr = !!ocr && (ocr.merchant || ocr.date || ocr.amount);

  function applyOcr(field: "merchant" | "date" | "amount") {
    if (!ocr) return;
    const value = ocr[field];
    if (value) form.setValue(field, value, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid max-w-md gap-4"
      >
        {hasOcr ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
            <p className="mb-2 font-medium text-blue-900">
              Review values read from your receipt
            </p>
            <div className="flex flex-wrap gap-2">
              {ocr?.amount ? (
                <Button type="button" variant="outline" size="sm" onClick={() => applyOcr("amount")}>
                  Amount: {ocr.amount}
                </Button>
              ) : null}
              {ocr?.date ? (
                <Button type="button" variant="outline" size="sm" onClick={() => applyOcr("date")}>
                  Date: {ocr.date}
                </Button>
              ) : null}
              {ocr?.merchant ? (
                <Button type="button" variant="outline" size="sm" onClick={() => applyOcr("merchant")}>
                  Merchant: {ocr.merchant}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  applyOcr("amount");
                  applyOcr("date");
                  applyOcr("merchant");
                }}
              >
                Apply all
              </Button>
            </div>
            <p className="mt-2 text-xs text-blue-900/70">
              Best-effort extraction — check each value before saving.
            </p>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount ({selCurrency})</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="500.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    {[currency, ...SUPPORTED_CURRENCIES.filter((c) => c !== currency)].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {isForeign ? (
          <div className="grid gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <FormField
              control={form.control}
              name="fxRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Exchange rate (1 {selCurrency} = ? {currency})
                  </FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="83.50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-muted-foreground text-xs" aria-live="polite">
              {(() => {
                const a = Number.parseFloat(watchedAmount || "0");
                const r = Number.parseFloat(fxRate || "0");
                return Number.isFinite(a) && Number.isFinite(r) && a > 0 && r > 0
                  ? `≈ ${selCurrency} ${a.toFixed(2)} → ${currency} ${(a * r).toFixed(2)} (exact value computed on save with banker's rounding)`
                  : "Prefilled from the daily rate when available — you can override it.";
              })()}
            </p>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
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
        {/* 6.3: billable + tax */}
        <div className="grid gap-3 rounded-lg border p-3">
          <FormField
            control={form.control}
            name="billable"
            render={({ field }) => (
              <FormItem>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="size-4"
                  />
                  Billable to a client
                </label>
              </FormItem>
            )}
          />
          {billable ? (
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      <option value="">Select a client…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="taxAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax amount (optional)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="18.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taxNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GST/VAT number (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="29AAACC1234F1Z5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* 6.3: splits */}
        <div className="grid gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Split across categories
              {splitArray.fields.length > 0
                ? ` (${(splitTotal / 100).toFixed(2)} / ${(amountMinor / 100).toFixed(2)})`
                : ""}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                splitArray.append(
                  splitArray.fields.length === 0
                    ? [
                        { categoryId: "", projectId: "", value: "" },
                        { categoryId: "", projectId: "", value: "" },
                      ]
                    : [{ categoryId: "", projectId: "", value: "" }]
                )
              }
            >
              {splitArray.fields.length === 0 ? "Split expense" : "Add line"}
            </Button>
          </div>
          {splitArray.fields.map((f, idx) => (
            <div key={f.id} className="flex flex-wrap items-end gap-2">
              <FormField
                control={form.control}
                name={`splits.${idx}.categoryId`}
                render={({ field }) => (
                  <FormItem className="min-w-36 flex-1">
                    <FormControl>
                      <NativeSelect aria-label="Split category" {...field}>
                        <option value="">Category…</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </NativeSelect>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`splits.${idx}.projectId`}
                render={({ field }) => (
                  <FormItem className="min-w-32 flex-1">
                    <FormControl>
                      <NativeSelect aria-label="Split project" {...field}>
                        <option value="">No project</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </NativeSelect>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`splits.${idx}.value`}
                render={({ field }) => (
                  <FormItem className="w-28">
                    <FormControl>
                      <Input aria-label="Split amount" inputMode="decimal" placeholder="0.00" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() =>
                  splitArray.fields.length <= 2
                    ? splitArray.replace([]) // a split needs ≥2 lines — clear it
                    : splitArray.remove(idx)
                }
              >
                Remove
              </Button>
            </div>
          ))}
          {splitArray.fields.length > 0 && !splitsMatch ? (
            <p className="text-sm text-amber-800" aria-live="polite">
              Split lines total {(splitTotal / 100).toFixed(2)} — they must equal the
              expense amount {(amountMinor / 100).toFixed(2)}.
            </p>
          ) : null}
        </div>

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
        {liveFlags.length > 0 ? (
          <div aria-live="polite" className="grid gap-1 rounded-lg border border-amber-200 bg-amber-50 p-2">
            <FlagChips flags={liveFlags} />
            <p className="text-xs text-amber-800/80">
              Policy warnings — you can still save and submit.
            </p>
          </div>
        ) : null}
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
