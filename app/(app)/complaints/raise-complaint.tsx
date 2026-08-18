"use client";

// "Raise complaint" entry point used on the report page and on each payment
// row. Posts multipart to /api/complaints so an attachment can ride along.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { COMPLAINT_TYPE_LABELS, type ComplaintType } from "@/lib/domain/complaint";

type Props = {
  reportId?: string;
  reimbursementId?: string;
  /** Restrict the type list — a payment dispute can't be an unfair rejection. */
  types: ComplaintType[];
  label?: string;
  hasPaymentProof?: boolean;
};

export function RaiseComplaint({
  reportId,
  reimbursementId,
  types,
  label = "Raise complaint",
  hasPaymentProof = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<ComplaintType>(types[0]);
  const [description, setDescription] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (description.trim().length < 10) {
      setError("Please describe the problem in a little more detail.");
      return;
    }
    setPending(true);
    try {
      const form = new FormData();
      form.set("type", type);
      form.set("description", description);
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
        setError(json.error ?? "Something went wrong.");
        return;
      }
      setOpen(false);
      setDescription("");
      setFile(null);
      router.push(`/complaints/${json.data?.id ?? ""}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm"
    >
      <p className="font-medium text-amber-900">Raise a complaint</p>

      <div className="grid gap-1">
        <label htmlFor="complaint-type" className="text-xs font-medium">
          What&apos;s wrong?
        </label>
        <NativeSelect
          id="complaint-type"
          value={type}
          onChange={(e) => setType(e.target.value as ComplaintType)}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {COMPLAINT_TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-1">
        <label htmlFor="complaint-description" className="text-xs font-medium">
          Tell us what happened
        </label>
        <Textarea
          id="complaint-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="The approved amount was ₹4,500 but only ₹3,200 came through…"
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="complaint-file" className="text-xs font-medium">
          Attach evidence (optional — JPG, PNG or PDF, up to 10 MB)
        </label>
        <input
          id="complaint-file"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-xs"
        />
        {hasPaymentProof ? (
          <p className="text-xs text-amber-800">
            The payment proof for this transfer is attached automatically.
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Submit complaint"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
