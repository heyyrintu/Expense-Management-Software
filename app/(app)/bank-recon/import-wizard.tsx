"use client";

// Upload + column-mapping wizard (7.2): preview 5 rows, pick columns
// (prefilled from the org's saved mapping or header heuristics), commit.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

type Preview = {
  headers: string[];
  preview: string[][];
  suggested: { dateCol?: number; amountCol?: number; referenceCol?: number };
  savedMappingUsed: boolean;
};

export function ImportWizard() {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [dateCol, setDateCol] = React.useState("");
  const [amountCol, setAmountCol] = React.useState("");
  const [referenceCol, setReferenceCol] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function post(stage: "preview" | "commit") {
    if (!file) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("stage", stage);
      if (stage === "commit") {
        form.set(
          "mapping",
          JSON.stringify({
            dateCol: Number(dateCol),
            amountCol: Number(amountCol),
            referenceCol: Number(referenceCol),
          })
        );
      }
      const res = await fetch("/api/bank-imports", { method: "POST", body: form });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: Preview & { lines?: number; matched?: number; skipped?: unknown[] };
      };
      if (!json.ok || !json.data) {
        setError(json.error ?? "Import failed.");
      } else if (stage === "preview") {
        setPreview(json.data);
        setDateCol(String(json.data.suggested.dateCol ?? ""));
        setAmountCol(String(json.data.suggested.amountCol ?? ""));
        setReferenceCol(String(json.data.suggested.referenceCol ?? ""));
      } else {
        setMessage(
          `Imported ${json.data.lines} lines — auto-matched ${json.data.matched}` +
            ((json.data.skipped?.length ?? 0) > 0
              ? `, ${json.data.skipped!.length} rows skipped`
              : "")
        );
        setPreview(null);
        setFile(null);
        router.refresh();
      }
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const colSelect = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void
  ) => (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-muted-foreground text-xs">{label}</label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-48">
        <option value="">Select column…</option>
        {preview?.headers.map((h, i) => (
          <option key={i} value={String(i)}>{h || `Column ${i + 1}`}</option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <div className="grid gap-3 rounded-xl border p-4">
      <h2 className="text-sm font-medium">Import a statement</h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label htmlFor="bank-file" className="text-muted-foreground text-xs">
            CSV or XLSX (≤ 2 MB)
          </label>
          <Input
            id="bank-file"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="w-72"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
        </div>
        <Button disabled={busy || !file} onClick={() => void post("preview")}>
          {busy ? "Reading…" : "Preview"}
        </Button>
      </div>

      {preview ? (
        <div className="grid gap-3">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i} className="p-2 font-medium">{h || `Col ${i + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, ri) => (
                  <tr key={ri} className="border-t">
                    {preview.headers.map((_, ci) => (
                      <td key={ci} className="p-2">{row[ci] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-xs">
            {preview.savedMappingUsed
              ? "Prefilled from your organization's saved mapping."
              : "Columns guessed from the headers — adjust if needed."}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            {colSelect("map-date", "Date column", dateCol, setDateCol)}
            {colSelect("map-amount", "Amount (debit) column", amountCol, setAmountCol)}
            {colSelect("map-ref", "Reference/UTR column", referenceCol, setReferenceCol)}
            <Button
              disabled={busy || dateCol === "" || amountCol === "" || referenceCol === ""}
              onClick={() => void post("commit")}
            >
              {busy ? "Importing…" : "Import & auto-match"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-green-700">{message}</p> : null}
    </div>
  );
}
