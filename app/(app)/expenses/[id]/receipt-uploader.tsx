"use client";

// Drag-and-drop receipt uploader (mobile-first: also a plain file input with
// capture-friendly accept types). Uploads via POST /api/receipts.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteReceiptAction } from "../receipt-actions";
import type { ReceiptView } from "./receipt-types";

export function ReceiptUploader({
  expenseId,
  receipts,
  readOnly,
}: {
  expenseId: string;
  receipts: ReceiptView[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("expenseId", expenseId);
      for (const f of list) form.append("files", f);
      const res = await fetch("/api/receipts", { method: "POST", body: form });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "Upload failed. Please try again.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(receiptId: string) {
    setError(null);
    setBusy(true);
    const res = await deleteReceiptAction({ receiptId });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="grid gap-3">
      <h2 className="text-sm font-medium">Receipts</h2>

      {receipts.length === 0 && readOnly ? (
        <p className="text-muted-foreground text-sm">No receipts attached.</p>
      ) : null}

      {receipts.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {receipts.map((r) => (
            <li key={r.id} className="grid gap-1">
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border"
                aria-label={`Open receipt ${r.fileName}`}
              >
                {r.mimeType === "application/pdf" ? (
                  <span className="bg-muted/50 flex h-24 items-center justify-center text-xs font-medium">
                    PDF — {r.fileName}
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.url}
                    alt={`Receipt ${r.fileName}`}
                    className="h-24 w-full object-cover"
                  />
                )}
              </a>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => remove(r.id)}
                  className="text-destructive w-fit px-1"
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!readOnly ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload receipts"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void upload(e.dataTransfer.files);
          }}
          className={cn(
            "text-muted-foreground grid cursor-pointer place-items-center rounded-lg border border-dashed p-6 text-center text-sm transition-colors",
            dragOver && "border-ring bg-muted/50"
          )}
        >
          {busy
            ? "Uploading…"
            : "Drag & drop JPG, PNG, or PDF here — or tap to choose (max 10 MB each)"}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void upload(e.target.files);
            }}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
