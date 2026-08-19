"use client";

// Statement import wizard (D4.2) — DESIGN-PRD §7.6, "a 3-step sheet
// (upload → map columns → review), with a live 5-row preview during mapping".
//
// ── WHY A SHEET, AND WHY THREE STEPS ──────────────────────────────────────
// Importing a statement is a task with a beginning and an end, performed
// occasionally, that must not be half-done. That is a sheet, not a panel
// sitting permanently on the reconciliation screen: it takes the focus, it
// says how far along you are, and closing it abandons nothing that was
// stored.
//
// The steps are not decoration either. Each one ends with a question the
// reader can actually answer:
//   Upload  — did we read your file? (row count, before any mapping)
//   Map     — do these columns mean what we think? (live 5-row preview)
//   Review  — is this what will be imported? (a real server dry run)
//
// Review runs `stage=validate` on the server rather than re-deriving counts
// in the browser. A review screen that recomputes its own numbers can agree
// with itself and still disagree with what the commit does.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Upload } from "lucide-react";
import { toast } from "sonner";

import { offlineAwareMessage } from "@/lib/errors";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateCell } from "@/components/ui/date-cell";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  STATEMENT_ACCEPT,
  validateStatementFile,
} from "@/lib/schemas/statement-file";
import { cn } from "@/lib/utils";

type PreviewData = {
  headers: string[];
  rowCount: number;
  preview: string[][];
  suggested: { dateCol?: number; amountCol?: number; referenceCol?: number };
  savedMappingUsed: boolean;
};

type ValidateData = {
  lines: number;
  skipped: Array<{ row: number; reason: string }>;
  periodStart: string | null;
  periodEnd: string | null;
};

const STEPS = ["Upload", "Map columns", "Review"] as const;

/** The three fields a statement line needs. Order is the reading order of a
 *  bank statement, so the dropdowns match the file on screen above them. */
const FIELDS = [
  { key: "dateCol", label: "Date", hint: "When the debit hit the account" },
  { key: "amountCol", label: "Amount (debit)", hint: "Credits and zeroes are skipped" },
  { key: "referenceCol", label: "Reference / UTR", hint: "Narration works too" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export function ImportSheet() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [file, setFile] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewData | null>(null);
  const [validated, setValidated] = React.useState<ValidateData | null>(null);
  const [mapping, setMapping] = React.useState<Record<FieldKey, string>>({
    dateCol: "",
    amountCol: "",
    referenceCol: "",
  });
  const [saveMapping, setSaveMapping] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setStep(0);
    setFile(null);
    setPreview(null);
    setValidated(null);
    setMapping({ dateCol: "", amountCol: "", referenceCol: "" });
    setSaveMapping(true);
    setError(null);
  }

  function acceptFile(next: File | null) {
    setError(null);
    if (!next) return;
    // The same function the route runs — client and server never disagree.
    const problem = validateStatementFile({ name: next.name, size: next.size });
    if (problem) {
      setError(problem);
      return;
    }
    setFile(next);
    setPreview(null);
  }

  async function post<T>(stage: string, extra?: Record<string, string>): Promise<T | null> {
    if (!file) return null;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("stage", stage);
      for (const [k, v] of Object.entries(extra ?? {})) form.set(k, v);
      const res = await fetch("/api/bank-imports", { method: "POST", body: form });
      const json = (await res.json()) as { ok: boolean; error?: string; data?: T };
      if (!json.ok || !json.data) {
        setError(json.error ?? "That didn't work. Try again.");
        return null;
      }
      return json.data;
    } catch {
      // A fetch that throws is a transport failure, and offline is the
      // likeliest cause on a phone — the advice differs, so say which.
      setError(offlineAwareMessage());
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function goToMapping() {
    const data = await post<PreviewData>("preview");
    if (!data) return;
    setPreview(data);
    setMapping({
      dateCol: data.suggested.dateCol?.toString() ?? "",
      amountCol: data.suggested.amountCol?.toString() ?? "",
      referenceCol: data.suggested.referenceCol?.toString() ?? "",
    });
    setStep(1);
  }

  async function goToReview() {
    const data = await post<ValidateData>("validate", {
      mapping: JSON.stringify({
        dateCol: Number(mapping.dateCol),
        amountCol: Number(mapping.amountCol),
        referenceCol: Number(mapping.referenceCol),
      }),
    });
    if (!data) return;
    setValidated(data);
    setStep(2);
  }

  async function commit() {
    const data = await post<{ lines: number; matched: number; skipped?: unknown[] }>(
      "commit",
      {
        mapping: JSON.stringify({
          dateCol: Number(mapping.dateCol),
          amountCol: Number(mapping.amountCol),
          referenceCol: Number(mapping.referenceCol),
        }),
        saveMapping: String(saveMapping),
      }
    );
    if (!data) return;
    toast.success(
      `Imported ${data.lines} lines — ${data.matched} matched automatically.`
    );
    setOpen(false);
    reset();
    router.refresh();
  }

  const mappingComplete = FIELDS.every((f) => mapping[f.key] !== "");
  /** Two fields pointing at one column is a mapping mistake, not a choice. */
  const duplicateColumn =
    new Set(FIELDS.map((f) => mapping[f.key]).filter(Boolean)).size !==
    FIELDS.filter((f) => mapping[f.key] !== "").length;

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Upload aria-hidden="true" className="size-4" />
        Import a statement
      </Button>

      <Sheet
        open={open}
        // Not dismissible mid-commit: the request is already in flight, and
        // closing would leave the reader with no idea whether it landed.
        onOpenChange={(next) => {
          if (busy) return;
          setOpen(next);
          if (!next) reset();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Import a bank statement</SheetTitle>
            <SheetDescription>
              Debits are matched against payments you have already recorded.
              Nothing is stored until the last step.
            </SheetDescription>
          </SheetHeader>

          <StepIndicator current={step} />

          <div className="grid gap-4 overflow-y-auto px-4">
            {step === 0 ? (
              <UploadStep
                file={file}
                dragging={dragging}
                rowCount={preview?.rowCount ?? null}
                onDragChange={setDragging}
                onFile={acceptFile}
              />
            ) : null}

            {step === 1 && preview ? (
              <MappingStep
                preview={preview}
                mapping={mapping}
                onChange={(key, value) =>
                  setMapping((prev) => ({ ...prev, [key]: value }))
                }
                duplicateColumn={duplicateColumn}
                saveMapping={saveMapping}
                onSaveMappingChange={setSaveMapping}
              />
            ) : null}

            {step === 2 && validated ? (
              <ReviewStep data={validated} saveMapping={saveMapping} />
            ) : null}

            {error ? (
              <p
                role="alert"
                className="border-status-danger-subtle bg-status-danger-subtle text-status-danger-text rounded-md border p-3 text-body"
              >
                {error}
              </p>
            ) : null}
          </div>

          <SheetFooter>
            {step > 0 ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </Button>
            ) : null}

            {step === 0 ? (
              <Button disabled={busy || !file} onClick={() => void goToMapping()}>
                {busy ? "Reading…" : "Read the file"}
              </Button>
            ) : null}

            {step === 1 ? (
              <Button
                disabled={busy || !mappingComplete || duplicateColumn}
                onClick={() => void goToReview()}
              >
                {busy ? "Checking…" : "Check the mapping"}
              </Button>
            ) : null}

            {step === 2 ? (
              <Button
                disabled={busy || (validated?.lines ?? 0) === 0}
                onClick={() => void commit()}
              >
                {busy ? "Importing…" : "Import and auto-match"}
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Progress indicator. Numbered, with completed steps taking a check —
 * a bare highlighted word tells you where you are but not how much is left,
 * and "how much is left" is the question a wizard exists to answer.
 */
function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 px-4" aria-label="Import progress">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-meta tabular",
                done && "bg-status-success text-text-inverse",
                active && "bg-accent text-text-inverse",
                !done && !active && "bg-bg-subtle text-text-tertiary"
              )}
            >
              {done ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-label truncate",
                active ? "text-text-primary" : "text-text-tertiary"
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 ? (
              <span aria-hidden="true" className="bg-line h-px flex-1" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function UploadStep({
  file,
  dragging,
  rowCount,
  onDragChange,
  onFile,
}: {
  file: File | null;
  dragging: boolean;
  rowCount: number | null;
  onDragChange: (next: boolean) => void;
  onFile: (file: File | null) => void;
}) {
  const inputId = React.useId();

  return (
    <div className="grid gap-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          onDragChange(true);
        }}
        onDragLeave={() => onDragChange(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDragChange(false);
          onFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "border-line grid cursor-pointer justify-items-center gap-2 rounded-lg border border-dashed p-8 text-center",
          "transition-colors duration-instant ease-out",
          "focus-within:ring-2 focus-within:ring-focus-ring focus-within:ring-offset-2",
          dragging ? "border-accent-border bg-accent-subtle" : "hover:bg-bg-subtle"
        )}
      >
        <Upload aria-hidden="true" className="text-text-tertiary size-6" />
        <span className="text-body text-text-primary">
          {file ? file.name : "Drop your statement here, or browse"}
        </span>
        <span className="text-meta text-text-tertiary">
          CSV or Excel, up to 2 MB
        </span>
        <input
          id={inputId}
          type="file"
          accept={STATEMENT_ACCEPT}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {rowCount !== null ? (
        <p className="text-meta text-text-secondary">
          {rowCount} data {rowCount === 1 ? "row" : "rows"} detected.
        </p>
      ) : null}
    </div>
  );
}

function MappingStep({
  preview,
  mapping,
  onChange,
  duplicateColumn,
  saveMapping,
  onSaveMappingChange,
}: {
  preview: PreviewData;
  mapping: Record<FieldKey, string>;
  onChange: (key: FieldKey, value: string) => void;
  duplicateColumn: boolean;
  saveMapping: boolean;
  onSaveMappingChange: (next: boolean) => void;
}) {
  // Which columns are spoken for, so the preview can highlight them live.
  const assigned = new Map<string, string>();
  for (const field of FIELDS) {
    if (mapping[field.key] !== "") assigned.set(mapping[field.key], field.label);
  }

  return (
    <div className="grid gap-4">
      <p className="text-meta text-text-tertiary">
        {preview.savedMappingUsed
          ? "Prefilled from the mapping you saved last time."
          : "Guessed from the column headers — check each one."}
      </p>

      <div className="grid gap-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="grid gap-1">
            <span className="text-label text-text-primary">{field.label}</span>
            <NativeSelect
              value={mapping[field.key]}
              onChange={(e) => onChange(field.key, e.target.value)}
            >
              <option value="">Choose a column…</option>
              {preview.headers.map((header, index) => (
                <option key={index} value={String(index)}>
                  {header || `Column ${index + 1}`}
                </option>
              ))}
            </NativeSelect>
            <span className="text-meta text-text-tertiary">{field.hint}</span>
          </label>
        ))}
      </div>

      {duplicateColumn ? (
        <p
          role="alert"
          className="border-status-warning-subtle bg-status-warning-subtle text-status-warning-text rounded-md border p-3 text-meta"
        >
          Two fields point at the same column. One of them is wrong.
        </p>
      ) : null}

      {/* The live preview. It updates as the dropdowns change, which is the
          whole point: the reader checks their mapping against their own data
          rather than against three column names. */}
      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-meta">
          <caption className="sr-only">
            The first five rows of the file, with mapped columns highlighted.
          </caption>
          <thead className="bg-bg-subtle">
            <tr>
              {preview.headers.map((header, index) => {
                const role = assigned.get(String(index));
                return (
                  <th
                    key={index}
                    scope="col"
                    className={cn(
                      "p-2 text-left font-medium whitespace-nowrap",
                      role ? "text-accent-text" : "text-text-tertiary"
                    )}
                  >
                    <span className="grid gap-0.5">
                      <span>{header || `Column ${index + 1}`}</span>
                      {/* The badge is what makes the highlight legible in
                          greyscale — colour alone never carries meaning. */}
                      {role ? (
                        <span className="text-text-tertiary">→ {role}</span>
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {preview.preview.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-line border-t">
                {preview.headers.map((_, colIndex) => (
                  <td
                    key={colIndex}
                    className={cn(
                      "p-2 whitespace-nowrap",
                      assigned.has(String(colIndex))
                        ? "bg-accent-subtle text-text-primary"
                        : "text-text-tertiary"
                    )}
                  >
                    {row[colIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="flex items-start gap-3">
        <Checkbox
          checked={saveMapping}
          onCheckedChange={(next) => onSaveMappingChange(next === true)}
        />
        <span className="grid gap-0.5">
          <span className="text-body text-text-primary">
            Save this mapping for next time
          </span>
          <span className="text-meta text-text-tertiary">
            Prefills the next import for everyone in the organisation. Leave it
            off for a one-off file from a different bank.
          </span>
        </span>
      </label>
    </div>
  );
}

function ReviewStep({
  data,
  saveMapping,
}: {
  data: ValidateData;
  saveMapping: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="border-line bg-bg-subtle grid gap-3 rounded-lg border p-4">
        <Row label="Debit rows to import" value={`${data.lines}`} />
        <Row
          label="Period"
          value={
            data.periodStart && data.periodEnd ? (
              <span className="flex items-center gap-1">
                <DateCell value={data.periodStart} />
                <span aria-hidden="true">–</span>
                <DateCell value={data.periodEnd} />
              </span>
            ) : (
              "—"
            )
          }
        />
        <Row
          label="Rows skipped"
          value={`${data.skipped.length}`}
          tone={data.skipped.length > 0 ? "warning" : undefined}
        />
      </div>

      {data.lines === 0 ? (
        <p
          role="alert"
          className="border-status-danger-subtle bg-status-danger-subtle text-status-danger-text rounded-md border p-3 text-body"
        >
          Nothing usable with this mapping. Go back and check the amount column
          — credits and zeroes are skipped, so a credits-only column reads as
          an empty statement.
        </p>
      ) : null}

      {data.skipped.length > 0 ? (
        // Every skipped row, with its reason and its line number. A count
        // alone ("12 rows skipped") is unactionable; the reader needs to know
        // whether those twelve were headers, credits, or their data.
        <details className="border-line rounded-lg border p-3">
          <summary className="text-label text-text-primary cursor-pointer">
            What was skipped
          </summary>
          <ul className="text-meta text-text-secondary mt-2 grid max-h-40 gap-1 overflow-y-auto">
            {data.skipped.map((row) => (
              <li key={row.row} className="tabular">
                Row {row.row} — {row.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="text-meta text-text-tertiary">
        {saveMapping
          ? "This column mapping will be saved and prefilled next time."
          : "This mapping will not be saved."}{" "}
        Auto-matching runs on import: exact reference first, then amount and
        date within three days when the pairing is unambiguous both ways.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warning";
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-meta text-text-tertiary">{label}</span>
      <span
        className={cn(
          "text-body tabular",
          tone === "warning" ? "text-status-warning-text" : "text-text-primary"
        )}
      >
        {value}
      </span>
    </div>
  );
}
