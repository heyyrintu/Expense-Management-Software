"use client";

// Bank details form (6.1): the account number is never echoed back — the
// user re-enters it in full whenever they update.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBankDetailsAction } from "./actions";

export function BankDetailsForm({
  defaults,
  hasExisting,
}: {
  defaults: { bankAccountName: string; bankIfsc: string; upiId: string };
  hasExisting: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(!hasExisting);
  const [name, setName] = React.useState(defaults.bankAccountName);
  const [number, setNumber] = React.useState("");
  const [ifsc, setIfsc] = React.useState(defaults.bankIfsc);
  const [upi, setUpi] = React.useState(defaults.upiId);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Update bank details
      </Button>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const res = await updateBankDetailsAction({
            bankAccountName: name,
            bankAccountNumber: number,
            bankIfsc: ifsc,
            upiId: upi,
          });
          if (!res.ok) {
            setMessage({ kind: "error", text: res.error });
          } else {
            setMessage({ kind: "ok", text: "Bank details saved." });
            setNumber("");
            setOpen(false);
            router.refresh();
          }
        });
      }}
    >
      <div className="grid gap-1">
        <label htmlFor="b-name" className="text-muted-foreground text-xs">Account holder name</label>
        <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <label htmlFor="b-number" className="text-muted-foreground text-xs">
          Account number {hasExisting ? "(re-enter in full to update)" : ""}
        </label>
        <Input
          id="b-number"
          inputMode="numeric"
          autoComplete="off"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Full account number"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <label htmlFor="b-ifsc" className="text-muted-foreground text-xs">IFSC (optional)</label>
          <Input id="b-ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value)} placeholder="HDFC0001234" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="b-upi" className="text-muted-foreground text-xs">UPI id (optional)</label>
          <Input id="b-upi" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" />
        </div>
      </div>
      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "text-destructive text-sm" : "text-sm text-green-700"}
        >
          {message.text}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !name || !number}>
          {pending ? "Saving…" : "Save bank details"}
        </Button>
        {hasExisting ? (
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
