"use client";

// Raise a complaint (D4.3) — DESIGN-PRD §7.7, PLAN 7.3.
//
// A sheet, and a CARD PICKER rather than a dropdown.
//
// ── WHY CARDS ─────────────────────────────────────────────────────────────
// There are exactly four types and they are not interchangeable: the type
// decides who handles the dispute and what evidence gets attached. A <select>
// hides three of four options behind a click and gives each one a bare label,
// so the reader picks the first plausible-sounding entry and finance spends a
// day re-triaging. Four visible cards with a line of explanation each turn
// "what's wrong?" into a question you can answer by reading.
//
// The type list is filtered by the caller — a payment dispute cannot be an
// unfair rejection — so a reader is never shown a card that would be refused.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { COMPLAINT_TYPE_LABELS, type ComplaintType } from "@/lib/domain/complaint";
import { cn } from "@/lib/utils";

/** One line each, in the employee's words rather than the schema's. */
const TYPE_HINTS: Record<ComplaintType, string> = {
  wrong_amount: "The figure approved or paid isn't what it should be.",
  unfair_rejection: "A report was rejected and you disagree with the reason.",
  payment_not_received: "It's marked as paid, but nothing reached your account.",
  other: "Something else about this report or payment.",
};

/** Long enough to be a description rather than a shrug. Mirrors the API. */
const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 2000;

export function RaiseComplaint({
  reportId,
  reimbursementId,
  types,
  label = "Raise complaint",
  hasPaymentProof = false,
}: {
  reportId?: string;
  reimbursementId?: string;
  /** Restrict the type list — a payment dispute can't be an unfair rejection. */
  types: ComplaintType[];
  label?: string;
  hasPaymentProof?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<ComplaintType | null>(null);
  const [description, setDescription] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const fileInputId = React.useId();

  function reset() {
    // A single pre-selected type would still be a choice the reader made
    // without reading, so nothing is selected by default even at length 1.
    setType(null);
    setDescription("");
    setFile(null);
    setError(null);
  }

  const ready = type !== null && description.trim().length >= MIN_DESCRIPTION;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    setPending(true);
    try {
      const form = new FormData();
      form.set("type", type);
      form.set("description", description.trim());
      if (reportId) form.set("reportId", reportId);
      if (reimbursementId) form.set("reimbursementId", reimbursementId);
      if (file) form.set("file", file);
      const res = await fetch("/api/complaints", { method: "POST", body: form });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { id: string; warning: string | null };
      };
      if (!json.ok) {
        setError(json.error ?? "That didn't send. Try again.");
        return;
      }
      toast.success("Complaint raised — finance has been notified.");
      setOpen(false);
      reset();
      router.push(`/complaints/${json.data?.id ?? ""}`);
      router.refresh();
    } catch {
      setError("That didn't send. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {label}
      </Button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          // Never dismiss mid-send: the request is in flight and the reader
          // would have no idea whether it landed.
          if (pending) return;
          setOpen(next);
          if (!next) reset();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Raise a complaint</SheetTitle>
            <SheetDescription>
              This goes to finance, never to the approver whose decision you
              are disputing. Target for a first response is five business days.
            </SheetDescription>
          </SheetHeader>

          <form
            id="raise-complaint-form"
            onSubmit={submit}
            className="grid gap-5 overflow-y-auto px-4"
          >
            <fieldset className="grid gap-2">
              <legend className="text-label text-text-primary pb-2">
                What&apos;s wrong?
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {types.map((option) => (
                  <TypeCard
                    key={option}
                    value={option}
                    selected={type === option}
                    onSelect={() => setType(option)}
                  />
                ))}
              </div>
            </fieldset>

            <label className="grid gap-1">
              <span className="text-label text-text-primary">
                Tell us what happened
              </span>
              <Textarea
                rows={5}
                value={description}
                maxLength={MAX_DESCRIPTION}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="The approved amount was ₹4,500 but only ₹3,200 came through…"
              />
              <span className="text-meta text-text-tertiary">
                {/* A remaining-characters counter only once it is close to
                    mattering — a live count from the first keystroke reads as
                    a limit being enforced rather than a field being filled. */}
                {description.length > MAX_DESCRIPTION - 200
                  ? `${MAX_DESCRIPTION - description.length} characters left`
                  : "The more specific, the faster this gets resolved."}
              </span>
            </label>

            <div className="grid gap-2">
              <span className="text-label text-text-primary">
                Attach evidence{" "}
                <span className="text-text-tertiary font-normal">(optional)</span>
              </span>

              {file ? (
                <div className="border-line flex items-center gap-3 rounded-md border p-3">
                  <Paperclip aria-hidden="true" className="text-text-tertiary size-4 shrink-0" />
                  <span className="text-body text-text-primary min-w-0 flex-1 truncate">
                    {file.name}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setFile(null)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor={fileInputId}
                  className={cn(
                    "border-line text-text-secondary flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3",
                    "hover:bg-bg-subtle transition-colors duration-instant ease-out",
                    "focus-within:ring-2 focus-within:ring-focus-ring focus-within:ring-offset-2"
                  )}
                >
                  <Paperclip aria-hidden="true" className="size-4 shrink-0" />
                  <span className="text-body">
                    Add a screenshot or statement — JPG, PNG or PDF, up to 10 MB
                  </span>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}

              {hasPaymentProof ? (
                <p className="text-meta text-text-tertiary">
                  The payment proof for this transfer is attached automatically
                  — you don&apos;t need to find it.
                </p>
              ) : null}
            </div>

            {error ? (
              <p
                role="alert"
                className="border-status-danger-subtle bg-status-danger-subtle text-status-danger-text rounded-md border p-3 text-body"
              >
                {error}
              </p>
            ) : null}
          </form>

          <SheetFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" form="raise-complaint-form" disabled={!ready || pending}>
              {pending ? "Sending…" : "Submit complaint"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * One type card. A real radio underneath — arrow keys, form association and
 * screen-reader semantics come free, and the visible card is the label.
 */
function TypeCard({
  value,
  selected,
  onSelect,
}: {
  value: ComplaintType;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "grid cursor-pointer content-start gap-1 rounded-lg border p-3",
        "transition-colors duration-instant ease-out",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-offset-2",
        selected
          ? "border-accent-border bg-accent-subtle"
          : "border-line hover:bg-bg-subtle"
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-label text-text-primary">
          {COMPLAINT_TYPE_LABELS[value]}
        </span>
        {/* A check, not just a tint: selection must survive greyscale. */}
        {selected ? (
          <Check aria-hidden="true" className="text-accent-text size-4 shrink-0" />
        ) : null}
      </span>
      <span className="text-meta text-text-tertiary">{TYPE_HINTS[value]}</span>
      <input
        type="radio"
        name="complaint-type"
        value={value}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
    </label>
  );
}
