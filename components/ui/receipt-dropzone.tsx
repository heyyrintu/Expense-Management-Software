"use client";

// ReceiptDropzone (D2.2) — DESIGN-PRD §6.2.
//
// Drag-and-drop on desktop, camera or file picker on a phone, several files
// at once, a thumbnail grid you can remove from, and a progress bar that
// lives in RESERVED SPACE so starting an upload never moves the page.
//
// The file rules are not re-decided here: it calls validateReceiptFile from
// lib/schemas/receipt.ts — the same pure function the upload route uses — so
// a file the client accepts is a file the server accepts, and the error copy
// is identical on both sides. Checking client-side isn't security (the route
// still validates); it is the difference between being told immediately and
// being told after uploading 12 MB.
import * as React from "react";
import { FileText, ImageIcon, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  RECEIPT_MAX_BYTES,
  validateReceiptFile,
  type ReceiptFileMeta,
} from "@/lib/schemas/receipt";
import { cn } from "@/lib/utils";

export type ReceiptItem = {
  id: string;
  fileName: string;
  mimeType: string;
  /** Signed URL — generated server-side after an org check. */
  url: string;
};

export type ReceiptDropzoneProps = {
  receipts: ReceiptItem[];
  /** Resolve when the upload finishes; reject/return a message on failure. */
  onUpload: (files: File[], onProgress: (fraction: number) => void) => Promise<void>;
  onRemove?: (receiptId: string) => Promise<void>;
  onOpen?: (receipt: ReceiptItem) => void;
  /** Hides every control — a submitted expense's receipts are read-only. */
  readOnly?: boolean;
  className?: string;
};

const ACCEPT = "image/jpeg,image/png,application/pdf";

export function ReceiptDropzone({
  receipts,
  onUpload,
  onRemove,
  onOpen,
  readOnly = false,
  className,
}: ReceiptDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [pendingNames, setPendingNames] = React.useState<string[]>([]);

  const uploading = progress !== null;

  async function accept(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Reject bad files BEFORE uploading, and name each one: "some files were
    // rejected" makes the reader compare their folder against a rule.
    const rejected: string[] = [];
    const good: File[] = [];
    for (const file of files) {
      const meta: ReceiptFileMeta = { name: file.name, type: file.type, size: file.size };
      const problem = validateReceiptFile(meta);
      if (problem) rejected.push(`${file.name} — ${problem}`);
      else good.push(file);
    }
    setErrors(rejected);
    if (good.length === 0) return;

    setPendingNames(good.map((f) => f.name));
    setProgress(0);
    try {
      await onUpload(good, (fraction) => setProgress(Math.min(1, Math.max(0, fraction))));
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Upload failed. Try again."]);
    } finally {
      setProgress(null);
      setPendingNames([]);
      if (inputRef.current) inputRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  const hasTiles = receipts.length > 0 || pendingNames.length > 0;

  return (
    <div className={cn("grid gap-3", className)}>
      {hasTiles ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <ReceiptTile
                receipt={receipt}
                onOpen={onOpen}
                onRemove={readOnly ? undefined : onRemove}
              />
            </li>
          ))}
          {/* Pending tiles occupy the grid slot the finished thumbnail will
              take, so the grid doesn't reflow when the upload lands. */}
          {pendingNames.map((name) => (
            <li key={`pending-${name}`}>
              <div className="border-line bg-bg-subtle grid h-24 place-items-center rounded-lg border">
                <span className="text-meta text-text-tertiary truncate px-2">{name}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* RESERVED SPACE. The strip is always in the layout while a dropzone is
          interactive, so a progress bar appearing pushes nothing down. */}
      {!readOnly ? (
        <div className="h-1" aria-hidden={!uploading}>
          {uploading ? (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((progress ?? 0) * 100)}
              aria-label="Uploading receipts"
              className="bg-bg-subtle h-1 w-full overflow-hidden rounded-full"
            >
              {/* scaleX, not width: a transform, so it animates on the
                  compositor and never triggers layout (§4.4). */}
              <div
                className="bg-accent h-full w-full origin-left transition-transform duration-instant ease-out"
                style={{ transform: `scaleX(${progress ?? 0})` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {readOnly ? (
        receipts.length === 0 ? (
          <p className="text-meta text-text-tertiary">No receipts attached.</p>
        ) : null
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Add receipts"
          aria-disabled={uploading || undefined}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!uploading) void accept(e.dataTransfer.files);
          }}
          className={cn(
            "grid cursor-pointer place-items-center gap-2 rounded-lg border border-dashed p-6 text-center",
            // 100ms fill to accent-subtle with a dashed accent border (§6.2).
            // Colour only — the box never grows on drag-over, because a
            // target that resizes as you approach it is a target that moves.
            "transition-colors duration-instant ease-out",
            "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
            dragOver
              ? "border-accent-border bg-accent-subtle"
              : "border-line-strong hover:bg-bg-subtle",
            uploading && "pointer-events-none opacity-60"
          )}
        >
          <Upload
            aria-hidden="true"
            className={cn("size-5", dragOver ? "text-accent-text" : "text-text-tertiary")}
          />
          <span className="text-body text-text-secondary">
            {uploading ? "Uploading…" : "Drop receipts here, or choose a file"}
          </span>
          <span className="text-meta text-text-tertiary">
            JPG, PNG or PDF · up to {Math.round(RECEIPT_MAX_BYTES / (1024 * 1024))} MB each
          </span>

          {/* A separate camera entry point: `capture` opens the camera
              directly on a phone, which is the whole point of capturing an
              expense where you incurred it. Hidden on desktop, where it
              would just be a second file picker. */}
          <span className="mt-1 flex gap-2 sm:hidden">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                cameraRef.current?.click();
              }}
            >
              Take a photo
            </Button>
          </span>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => e.target.files && void accept(e.target.files)}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => e.target.files && void accept(e.target.files)}
          />
        </div>
      )}

      {errors.length > 0 ? (
        <ul role="alert" className="grid gap-1">
          {errors.map((message) => (
            <li key={message} className="text-meta text-status-danger-text">
              {message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * One thumbnail.
 *
 * PDFs render their FIRST PAGE through <object> (§6.2). The browser's own
 * viewer does the rendering, so there is no pdf.js in the bundle, and
 * <object>'s native fallback — its children — covers every browser that
 * won't: those readers get a labelled file tile instead of a blank box.
 */
function ReceiptTile({
  receipt,
  onOpen,
  onRemove,
}: {
  receipt: ReceiptItem;
  onOpen?: (receipt: ReceiptItem) => void;
  onRemove?: (receiptId: string) => Promise<void>;
}) {
  const [removing, setRemoving] = React.useState(false);
  const isPdf = receipt.mimeType === "application/pdf";

  return (
    <div className="group border-line bg-bg-surface relative overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => onOpen?.(receipt)}
        aria-label={`Open receipt ${receipt.fileName}`}
        className={cn(
          "block h-24 w-full",
          "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset"
        )}
      >
        {isPdf ? (
          <object
            data={`${receipt.url}#page=1&toolbar=0&navpanes=0&view=FitH`}
            type="application/pdf"
            aria-label={`First page of ${receipt.fileName}`}
            // pointer-events-none so the click lands on the button, not
            // inside the embedded viewer.
            className="pointer-events-none h-24 w-full"
          >
            <span className="bg-bg-subtle text-text-tertiary flex h-24 items-center justify-center gap-2 text-meta">
              <FileText aria-hidden="true" className="size-4" />
              PDF
            </span>
          </object>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={receipt.url}
            alt={`Receipt ${receipt.fileName}`}
            // D5.4. A phone photo is several megabytes and this box is 96px
            // tall, so a grid of them was downloading tens of MB to render
            // postage stamps.
            //
            // `loading="lazy"` stops the ones below the fold competing with
            // the ones on screen, and `decoding="async"` keeps the decode off
            // the main thread — on a 12-receipt report that is the difference
            // between a smooth scroll and a stutter.
            //
            // NOT next/image: these are SIGNED, short-lived, PRIVATE S3 URLs.
            // The optimizer would cache by full URL including the signature
            // (so every rotation is a cache miss) and would proxy someone's
            // bank receipt through the app server. The right fix is a
            // thumbnail generated at upload time — recorded in
            // docs/PERF-AUDIT.md as the follow-up it is.
            loading="lazy"
            decoding="async"
            width={320}
            height={96}
            className="h-24 w-full object-cover"
          />
        )}
      </button>

      {onRemove ? (
        <button
          type="button"
          disabled={removing}
          onClick={async () => {
            setRemoving(true);
            try {
              await onRemove(receipt.id);
            } finally {
              setRemoving(false);
            }
          }}
          aria-label={`Remove receipt ${receipt.fileName}`}
          className={cn(
            "bg-bg-surface/90 text-text-secondary hover:text-status-danger-text absolute top-1 right-1 grid size-8 place-items-center rounded-full",
            // Visible on hover, on focus, and ALWAYS on touch — a control that
            // only appears on hover is a control a phone cannot reach.
            "opacity-0 transition-opacity duration-instant ease-out",
            "group-hover:opacity-100 focus-visible:opacity-100",
            "[@media(hover:none)]:opacity-100",
            "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          )}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}

      <span className="text-meta text-text-tertiary flex items-center gap-1 truncate px-2 py-1">
        {isPdf ? (
          <FileText aria-hidden="true" className="size-3 shrink-0" />
        ) : (
          <ImageIcon aria-hidden="true" className="size-3 shrink-0" />
        )}
        <span className="truncate">{receipt.fileName}</span>
      </span>
    </div>
  );
}
