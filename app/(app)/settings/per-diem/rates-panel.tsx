"use client";

// Per-diem rate editor. Two modes from one component: the add form at the top
// of the screen, and a per-row edit/retire control in the table.
//
// The retire path is deliberately more prominent than the delete path.
// Deleting a rate that has priced an expense is refused by the database (the
// FK is RESTRICT), because losing the link would leave an amount nobody can
// re-derive — so the action that always works is offered first, and delete is
// there for the genuine case of a rate added by mistake.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AmountInput, Input } from "@/components/ui/input";
import { toDecimalString } from "@/lib/money";
import {
  createPerDiemRateAction,
  deletePerDiemRateAction,
  updatePerDiemRateAction,
} from "./actions";

type Editing = {
  id: string;
  name: string;
  location: string;
  dailyAmount: number;
  effectiveFrom: string;
  active: boolean;
};

export function PerDiemRatesPanel({
  currency,
  editing,
}: {
  currency: string;
  editing?: Editing;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(editing?.name ?? "");
  const [location, setLocation] = React.useState(editing?.location ?? "");
  const [amount, setAmount] = React.useState(
    editing ? toDecimalString(editing.dailyAmount) : ""
  );
  const [effectiveFrom, setEffectiveFrom] = React.useState(
    editing?.effectiveFrom ?? new Date().toISOString().slice(0, 10)
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, close = true) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "That didn't save.");
        return;
      }
      if (!editing) {
        setName("");
        setLocation("");
        setAmount("");
      }
      if (close) setOpen(false);
      router.refresh();
    });
  }

  // ── Row mode: edit / retire one existing version ────────────────────────
  if (editing) {
    return (
      <span className="grid justify-items-end gap-2">
        <span className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? "Cancel" : "Edit"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  updatePerDiemRateAction({
                    id: editing.id,
                    name: editing.name,
                    location: editing.location,
                    dailyAmount: toDecimalString(editing.dailyAmount),
                    effectiveFrom: editing.effectiveFrom,
                    active: !editing.active,
                  }),
                false
              )
            }
          >
            {editing.active ? "Retire" : "Reinstate"}
          </Button>
        </span>

        {open ? (
          <form
            className="border-line bg-bg-surface grid gap-2 rounded-lg border p-3 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              run(() =>
                updatePerDiemRateAction({
                  id: editing.id,
                  name,
                  location,
                  dailyAmount: amount,
                  effectiveFrom,
                  active: editing.active,
                })
              );
            }}
          >
            <Fields
              idPrefix={`edit-${editing.id}`}
              currency={currency}
              name={name}
              setName={setName}
              location={location}
              setLocation={setLocation}
              amount={amount}
              setAmount={setAmount}
              effectiveFrom={effectiveFrom}
              setEffectiveFrom={setEffectiveFrom}
            />
            <span className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => deletePerDiemRateAction({ id: editing.id }))}
              >
                Delete
              </Button>
            </span>
            {error ? (
              <p role="alert" className="text-status-danger-text text-meta">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}
      </span>
    );
  }

  // ── Add mode ────────────────────────────────────────────────────────────
  return (
    <form
      className="border-line grid max-w-3xl gap-3 rounded-lg border p-4 sm:grid-cols-5 sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          createPerDiemRateAction({
            name,
            location,
            dailyAmount: amount,
            effectiveFrom,
            active: true,
          })
        );
      }}
    >
      <Fields
        idPrefix="new"
        currency={currency}
        name={name}
        setName={setName}
        location={location}
        setLocation={setLocation}
        amount={amount}
        setAmount={setAmount}
        effectiveFrom={effectiveFrom}
        setEffectiveFrom={setEffectiveFrom}
      />
      <Button type="submit" disabled={pending || !name.trim() || !amount.trim()}>
        {pending ? "Saving…" : "Add rate"}
      </Button>
      {error ? (
        <p role="alert" className="text-status-danger-text text-meta sm:col-span-5">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** The four fields, shared by both modes so they cannot drift apart. */
function Fields({
  idPrefix,
  currency,
  name,
  setName,
  location,
  setLocation,
  amount,
  setAmount,
  effectiveFrom,
  setEffectiveFrom,
}: {
  idPrefix: string;
  currency: string;
  name: string;
  setName: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  effectiveFrom: string;
  setEffectiveFrom: (v: string) => void;
}) {
  return (
    <>
      <div className="grid gap-1">
        <label htmlFor={`${idPrefix}-name`} className="text-text-tertiary text-xs">
          Name
        </label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tier 1 metro"
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${idPrefix}-location`} className="text-text-tertiary text-xs">
          Location (optional)
        </label>
        <Input
          id={`${idPrefix}-location`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Mumbai"
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${idPrefix}-amount`} className="text-text-tertiary text-xs">
          Daily amount
        </label>
        <AmountInput
          id={`${idPrefix}-amount`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="2500.00"
          currencySymbol={currency === "INR" ? "₹" : currency}
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${idPrefix}-from`} className="text-text-tertiary text-xs">
          Effective from
        </label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
      </div>
    </>
  );
}
