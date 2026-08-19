"use client";

// Bank details (D4.4, PLAN 6.1).
//
// Two halves, and the split is the security design:
//
//   READING   the stored number is shown MASKED, and the full value arrives
//             only when the reader presses Reveal — a server action that
//             takes no id and resolves the identity from the session.
//
//   WRITING   the number is never echoed into the form. Updating means
//             typing it in full, which is deliberate: a pre-filled account
//             number is a field people tab past, and the one thing worse
//             than retyping sixteen digits is paying into the old ones.
//
// The other three fields ARE pre-filled and use the sticky save bar, because
// an IFSC or UPI id is safe to show and tedious to retype.
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DirtySaveBar } from "@/components/ui/dirty-save-bar";
import { Input } from "@/components/ui/input";
import { MaskedValue } from "@/components/ui/masked-value";
import { revealOwnAccountNumberAction, updateBankDetailsAction } from "./actions";

type Defaults = { bankAccountName: string; bankIfsc: string; upiId: string };

export function BankDetailsForm({
  defaults,
  maskedAccountNumber,
}: {
  defaults: Defaults;
  /** Already masked by the server. Null when nothing is on file. */
  maskedAccountNumber: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Defaults>(defaults);
  const [accountNumber, setAccountNumber] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const hasExisting = maskedAccountNumber !== null;

  // Dirty is a real comparison against what the server last confirmed, so
  // typing a character and deleting it puts the bar away again.
  const dirty =
    accountNumber !== "" ||
    values.bankAccountName !== defaults.bankAccountName ||
    values.bankIfsc !== defaults.bankIfsc ||
    values.upiId !== defaults.upiId;

  function set<K extends keyof Defaults>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function discard() {
    setValues(defaults);
    setAccountNumber("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateBankDetailsAction({
        ...values,
        bankAccountNumber: accountNumber,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Never keep the typed number in state after a save.
      setAccountNumber("");
      toast.success("Bank details saved.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid max-w-lg gap-4">
      {hasExisting ? (
        <div className="border-line bg-bg-subtle grid gap-1 rounded-lg border p-3">
          <span className="text-meta text-text-tertiary">
            Account number on file
          </span>
          <MaskedValue
            masked={maskedAccountNumber}
            label="account number"
            onReveal={revealOwnAccountNumberAction}
          />
        </div>
      ) : (
        <p className="text-body text-text-secondary">
          No bank details on file yet — finance can&apos;t reimburse you until
          there are.
        </p>
      )}

      <label className="grid gap-1">
        <span className="text-label text-text-primary">Account holder</span>
        <Input
          value={values.bankAccountName}
          onChange={(e) => set("bankAccountName", e.target.value)}
          placeholder="As printed on the passbook"
          autoComplete="name"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-label text-text-primary">
          Account number
          {hasExisting ? (
            <span className="text-text-tertiary font-normal">
              {" "}
              — leave blank to keep the current one
            </span>
          ) : null}
        </span>
        <Input
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="6–20 digits"
          className="tabular"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-label text-text-primary">IFSC</span>
        <Input
          value={values.bankIfsc}
          onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())}
          placeholder="HDFC0001234"
          autoComplete="off"
          className="tabular"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-label text-text-primary">
          UPI id <span className="text-text-tertiary font-normal">(optional)</span>
        </span>
        <Input
          value={values.upiId}
          onChange={(e) => set("upiId", e.target.value.toLowerCase())}
          placeholder="name@bank"
          autoComplete="off"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="border-status-danger-subtle bg-status-danger-subtle text-status-danger-text rounded-md border p-3 text-body"
        >
          {error}
        </p>
      ) : null}

      <DirtySaveBar dirty={dirty} pending={pending} onDiscard={discard} />

      {/* An existing record can't be saved without re-entering the number,
          because the action requires one. Said here rather than discovered
          from a validation error after pressing Save. */}
      {dirty && hasExisting && accountNumber === "" ? (
        <p className="text-meta text-text-tertiary">
          Re-enter the account number to save any change — it is never sent
          back to this page for editing.
        </p>
      ) : null}
    </form>
  );
}
