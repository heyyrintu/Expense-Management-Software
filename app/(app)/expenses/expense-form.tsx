"use client";

// Add / edit expense — DESIGN-PRD §7.1, the product's front door.
//
// Mobile-first single column, thumb-reachable, in the order §7.1 fixes:
// receipt → amount → merchant → category → date → project → purpose.
// That order is not alphabetical or historical; it is the order the
// information exists in. You are holding a receipt, so the receipt comes
// first, and the amount is the thing you are least willing to retype.
//
// Everything below the purpose field — currency, FX, billable, tax, splits —
// lives behind "More options", collapsed by default. Those fields matter to a
// minority of expenses and were previously the majority of the form, which is
// how a 60-second capture becomes a two-minute one.
//
// PRESENTATION ONLY. Same actions, same Zod schema, same policy preview. The
// fields, their names and their validation are untouched — only the order,
// the grouping and the chrome around them changed.
import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { ChevronDown, Receipt as ReceiptIcon } from "lucide-react";

import { Amount } from "@/components/ui/amount";
import { AmountInput } from "@/components/ui/amount-input";
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
import { OcrReviewCard, type OcrField, type OcrValues } from "@/components/ui/ocr-review-card";
import { PolicyFlagChips } from "@/components/ui/policy-flag-chip";
import { SavedIndicator } from "@/components/ui/saved-indicator";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import type { Result } from "@/lib/errors";
import { toDecimalString } from "@/lib/money";
import { expenseInputSchema, type ExpenseInput } from "@/lib/schemas/expense";
import { cn } from "@/lib/utils";
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

/** Currency symbols for the amount adornment. Falls back to the code. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
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
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseInputSchema) as Resolver<ExpenseInput>,
    defaultValues: defaults,
  });

  /** `then` runs only after the action succeeds. */
  function submit(then: () => void) {
    return form.handleSubmit((values) => {
      setServerError(null);
      startTransition(async () => {
        const result = await action(values);
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        // The indicator reports a save that actually happened.
        setSavedAt(Date.now());
        then();
      });
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

  // Flags are shown under the field that caused them (§7.1). Anything the
  // rule map doesn't attribute to a field falls through to the amount, which
  // is where limit and duplicate rules belong anyway.
  const flagsByField = groupFlagsByField(liveFlags);

  // The card is editable, so what OCR read becomes local state the reader can
  // correct BEFORE it touches the form. Correcting a wrong guess in place is
  // faster than accepting it and then hunting for the field to fix.
  const [ocrValues, setOcrValues] = React.useState<OcrValues>(() => ({
    merchant: ocr?.merchant,
    date: ocr?.date,
    amount: ocr?.amount,
  }));
  const [ocrDismissed, setOcrDismissed] = React.useState(false);
  const hasOcr = !!ocr && (ocr.merchant || ocr.date || ocr.amount);
  // A receipt with nothing read still gets the card — that is where the
  // "couldn't read this" copy lives, and silence would leave the reader
  // wondering whether anything happened.
  const showOcrCard = !ocrDismissed && (receiptCount > 0 || hasOcr);

  function acceptOcr() {
    for (const field of ["merchant", "date", "amount"] as const) {
      const value = ocrValues[field];
      if (value) form.setValue(field, value, { shouldValidate: true, shouldDirty: true });
    }
    setOcrDismissed(true);
  }

  const advancedCount = countAdvanced(form.watch());

  return (
    <Form {...form}>
      {/* Single column, capped at a readable measure. Not a two-column grid:
          on a phone it stacks anyway, and on desktop a 2-up money form makes
          you read in a Z rather than straight down. */}
      <form onSubmit={submit(() => goToList(router))} className="grid max-w-lg gap-5">
        {/* ---- 1. Receipt ------------------------------------------------ */}
        <section className="grid gap-2">
          <h2 className="text-label text-text-secondary">Receipt</h2>
          {showOcrCard ? (
            <OcrReviewCard
              values={ocrValues}
              onChange={(field: OcrField, value) =>
                setOcrValues((prev) => ({ ...prev, [field]: value }))
              }
              onAccept={acceptOcr}
              onDismiss={() => setOcrDismissed(true)}
            />
          ) : (
            <div className="border-line text-text-tertiary flex items-center gap-2 rounded-lg border border-dashed p-4 text-meta">
              <ReceiptIcon aria-hidden="true" className="size-4 shrink-0" />
              {receiptCount > 0
                ? `${receiptCount} receipt${receiptCount === 1 ? "" : "s"} attached`
                : "Save the expense first, then attach a receipt on its page."}
            </div>
          )}
        </section>

        {/* ---- 2. Amount — the hero field -------------------------------- */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <AmountInput
                  value={field.value}
                  onValueChange={(text) => field.onChange(text)}
                  onBlur={field.onBlur}
                  currencySymbol={CURRENCY_SYMBOLS[selCurrency] ?? ""}
                  currencyCode={selCurrency}
                  autoFocus={!expenseId && !hasOcr}
                />
              </FormControl>
              <FormMessage />
              <PolicyFlagChips flags={flagsByField.amount} />
            </FormItem>
          )}
        />

        {/* ---- 3. Merchant ----------------------------------------------- */}
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
              <PolicyFlagChips flags={flagsByField.merchant} />
            </FormItem>
          )}
        />

        {/* ---- 4. Category ----------------------------------------------- */}
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
              <PolicyFlagChips flags={flagsByField.categoryId} />
            </FormItem>
          )}
        />

        {/* ---- 5. Date ---------------------------------------------------- */}
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
              <PolicyFlagChips flags={flagsByField.date} />
            </FormItem>
          )}
        />

        {/* ---- 6. Project -------------------------------------------------- */}
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

        {/* ---- 7. Purpose -------------------------------------------------- */}
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

        {/* ---- Everything the majority of expenses don't need -------------- */}
        <section className="border-line grid gap-4 rounded-lg border p-4">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={cn(
              "text-label text-text-secondary hover:text-text-primary flex h-11 items-center justify-between gap-2 rounded-md",
              "transition-colors duration-instant ease-out",
              "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
            )}
          >
            <span className="flex items-center gap-2">
              More options
              {advancedCount > 0 ? (
                <span className="bg-accent-subtle text-accent-text rounded-sm px-1 text-meta tabular">
                  {advancedCount}
                </span>
              ) : null}
            </span>
            {/* A rotation is a transform, so it costs nothing to animate. */}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 transition-transform duration-fast ease-out",
                moreOpen && "rotate-180"
              )}
            />
          </button>

          {moreOpen ? (
            <div className="grid gap-4">
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

              {isForeign ? (
                <div className="border-line bg-bg-subtle grid gap-2 rounded-lg border p-3">
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
                  <p className="text-meta text-text-tertiary" aria-live="polite">
                    {(() => {
                      const a = Number.parseFloat(watchedAmount || "0");
                      const r = Number.parseFloat(fxRate || "0");
                      // The currency CODE is already in the sentence, so these
                      // are bare decimals — toDecimalString, not formatMoney.
                      const fromMinor = Math.round(a * 100);
                      const toMinor = Math.round(a * r * 100);
                      return Number.isFinite(a) &&
                        Number.isFinite(r) &&
                        a > 0 &&
                        r > 0 &&
                        Number.isSafeInteger(fromMinor) &&
                        Number.isSafeInteger(toMinor)
                        ? `≈ ${selCurrency} ${toDecimalString(fromMinor)} → ${currency} ${toDecimalString(toMinor)} (exact value computed on save with banker's rounding)`
                        : "Prefilled from the daily rate when available — you can override it.";
                    })()}
                  </p>
                </div>
              ) : null}

              <FormField
                control={form.control}
                name="billable"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-body text-text-secondary flex min-h-11 items-center gap-2">
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

              <div className="grid gap-4 sm:grid-cols-2">
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

              {/* 6.3: splits */}
              <div className="border-line grid gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-label text-text-secondary">
                    Split across categories
                    {splitArray.fields.length > 0 ? (
                      <>
                        {" ("}
                        <Amount value={splitTotal} currency={selCurrency} size="meta" />
                        {" / "}
                        <Amount value={amountMinor} currency={selCurrency} size="meta" />
                        {")"}
                      </>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
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
                  <p className="text-meta text-status-warning-text" aria-live="polite">
                    Split lines total{" "}
                    <Amount value={splitTotal} currency={selCurrency} size="meta" /> — they
                    must equal the expense amount{" "}
                    <Amount value={amountMinor} currency={selCurrency} size="meta" />.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

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

        {/* §7.1: exactly one filled button on the screen. */}
        <StickyActionBar status={<SavedIndicator savedAt={savedAt} />}>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={submit(() => goToList(router))}
          >
            Save draft
          </Button>
          <Button type="button" loading={pending} onClick={submit(() => goToReports(router))}>
            Add to report
          </Button>
        </StickyActionBar>
      </form>
    </Form>
  );
}

function goToList(router: ReturnType<typeof useRouter>) {
  router.push("/expenses");
  router.refresh();
}

/**
 * "Add to report" saves the expense — which is what creating it does today,
 * a Draft — and then takes you to reports. Attaching it to a specific report
 * without leaving the screen is the report builder's job (D2.3); the button
 * is here because §7.1 puts it here, and it goes somewhere true rather than
 * pretending to do something it can't yet.
 */
function goToReports(router: ReturnType<typeof useRouter>) {
  router.push("/reports");
  router.refresh();
}

type FieldFlags = {
  amount: ReturnType<typeof usePolicyPreview>;
  merchant: ReturnType<typeof usePolicyPreview>;
  categoryId: ReturnType<typeof usePolicyPreview>;
  date: ReturnType<typeof usePolicyPreview>;
};

/** Which field a policy rule is about (§7.1: "inline below the offending field"). */
const RULE_FIELD: Record<string, keyof FieldFlags> = {
  per_expense_limit: "amount",
  monthly_limit: "amount",
  receipt_required: "amount",
  expense_age: "date",
  duplicate: "merchant",
};

function groupFlagsByField(flags: ReturnType<typeof usePolicyPreview>): FieldFlags {
  const out: FieldFlags = { amount: [], merchant: [], categoryId: [], date: [] };
  for (const flag of flags) {
    // Unattributed rules land on the amount — where limit and duplicate rules
    // belong anyway, and never nowhere.
    out[RULE_FIELD[flag.rule] ?? "amount"].push(flag);
  }
  return out;
}

/** How many advanced fields carry a non-default value, for the badge. */
function countAdvanced(values: ExpenseInput): number {
  let n = 0;
  if (values.billable) n += 1;
  if (values.clientId) n += 1;
  if (values.taxAmount) n += 1;
  if (values.taxNumber) n += 1;
  if (values.splits && values.splits.length > 0) n += 1;
  return n;
}
