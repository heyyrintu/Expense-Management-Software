"use client";

// The export flow: choose → preview → generate.
//
// ── PREVIEW IS NOT OPTIONAL, AND IT IS NOT A SECOND CALCULATION ───────────
// The button that downloads is disabled until a preview has run, and the
// preview calls the same adapter the download does. So the line count and
// total on screen are the file's, not an estimate of it. Money movement is
// never optimistic (CLAUDE.md) and neither is money REPORTING: a file that
// posts to a general ledger gets the same treatment as a payment run.
import * as React from "react";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateCell } from "@/components/ui/date-cell";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { AccountingTarget } from "@/lib/exports/accounting/types";
import { previewExportAction, runExportAction, type ExportPreview } from "./actions";

export function ExportPanel({
  currency,
  defaultStart,
  defaultEnd,
  targets,
}: {
  currency: string;
  defaultStart: string;
  defaultEnd: string;
  targets: Array<{ target: AccountingTarget; label: string; description: string }>;
}) {
  const [target, setTarget] = React.useState<AccountingTarget>(
    targets[0]?.target ?? "quickbooks"
  );
  const [start, setStart] = React.useState(defaultStart);
  const [end, setEnd] = React.useState(defaultEnd);
  const [allowReExport, setAllowReExport] = React.useState(false);
  const [preview, setPreview] = React.useState<ExportPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // ANY change to the inputs invalidates the preview. Without this the reader
  // could preview one period, switch to another, and download a file whose
  // numbers they never actually saw.
  React.useEffect(() => {
    setPreview(null);
  }, [target, start, end, allowReExport]);

  const request = { target, start, end, reportIds: [], allowReExport };

  function onPreview() {
    setError(null);
    startTransition(async () => {
      const res = await previewExportAction(request);
      if (!res.ok) {
        setError(res.error);
        setPreview(null);
      } else {
        setPreview(res.data);
      }
    });
  }

  function onGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await runExportAction(request);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // A Blob built in the page, not a link to a route: the file is derived
      // from data already durable, so there is nothing to persist and no
      // signed URL to rotate.
      const blob = new Blob([res.data.content], { type: res.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      // The run is recorded, so the preview is now stale — those reports have
      // become "already exported".
      setPreview(null);
    });
  }

  const active = targets.find((t) => t.target === target);

  return (
    <div className="grid max-w-3xl gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1">
          <label htmlFor="ae-target" className="text-text-tertiary text-xs">
            Accounting system
          </label>
          <NativeSelect
            id="ae-target"
            value={target}
            onChange={(e) => setTarget(e.target.value as AccountingTarget)}
          >
            {targets.map((t) => (
              <option key={t.target} value={t.target}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <label htmlFor="ae-start" className="text-text-tertiary text-xs">
            Period from
          </label>
          <Input
            id="ae-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="ae-end" className="text-text-tertiary text-xs">
            Period to
          </label>
          <Input
            id="ae-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>
      {active ? (
        <p className="text-meta text-text-tertiary">{active.description}</p>
      ) : null}

      <label className="flex items-start gap-3">
        <Checkbox
          checked={allowReExport}
          onCheckedChange={(v) => setAllowReExport(v === true)}
        />
        <span className="grid gap-0.5">
          <span className="text-body text-text-primary">
            Re-export reports already sent to this system
          </span>
          {/* The consequence, stated. Importing the same journal entry twice
              does not error in QuickBooks — it posts the cost again. */}
          <span className="text-meta text-text-tertiary">
            Off by default. Importing the same entry twice posts the cost
            twice; your accounting system will not warn you.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onPreview} loading={pending}>
          Preview
        </Button>
        <Button
          onClick={onGenerate}
          disabled={!preview?.canExport || pending}
          loading={pending && preview !== null}
        >
          Generate file
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-status-danger-text text-body">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="border-line bg-bg-surface grid gap-4 rounded-lg border p-5" aria-live="polite">
          <div className="grid gap-1">
            <span className="text-label text-text-secondary">
              {preview.adapterLabel}
            </span>
            <span className="flex flex-wrap items-baseline gap-4">
              <span className="grid">
                <Amount value={preview.totalMinor} currency={currency} size="display" />
                <span className="text-meta text-text-tertiary">
                  {preview.lineCount} line{preview.lineCount === 1 ? "" : "s"} ·{" "}
                  {preview.includedCount} report
                  {preview.includedCount === 1 ? "" : "s"}
                </span>
              </span>
            </span>
          </div>

          {preview.unmapped.length > 0 ? (
            <div className="border-status-warning bg-status-warning-subtle text-status-warning-text grid gap-2 rounded-lg border p-4">
              <span className="text-body font-medium">
                {preview.unmapped.length} record
                {preview.unmapped.length === 1 ? "" : "s"} need an account code
              </span>
              <ul className="grid gap-1">
                {preview.unmapped.map((u) => (
                  <li key={`${u.entityType}:${u.localId}`} className="text-meta">
                    {u.label} ({u.entityType}) — {u.affectedLines} line
                    {u.affectedLines === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
              <span className="text-meta">
                Map them in Settings → Accounting. The export will not guess.
              </span>
            </div>
          ) : null}

          {preview.alreadyExported.length > 0 ? (
            <div
              className={
                allowReExport
                  ? "border-status-warning bg-status-warning-subtle text-status-warning-text grid gap-2 rounded-lg border p-4"
                  : "border-line bg-bg-subtle text-text-secondary grid gap-2 rounded-lg border p-4"
              }
            >
              <span className="text-body font-medium">
                {allowReExport
                  ? `Re-sending ${preview.alreadyExported.length} report${preview.alreadyExported.length === 1 ? "" : "s"}`
                  : `${preview.alreadyExported.length} report${preview.alreadyExported.length === 1 ? "" : "s"} already exported — excluded`}
              </span>
              <ul className="grid gap-1">
                {preview.alreadyExported.map((a) => (
                  <li key={a.reportId} className="text-meta">
                    {a.title} — sent{" "}
                    <DateCell value={a.exportedAt} format="relative" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.blockedReason ? (
            <p className="text-body text-status-danger-text">{preview.blockedReason}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
