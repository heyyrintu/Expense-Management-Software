"use client";

// Receipt capture (D2.2) — DESIGN-PRD §6.2.
//
// The gallery matters more than usual here: drag-over, mid-upload progress and
// an OCR miss are all states you cannot reach on the real screen without a
// file, a slow network and a bad photograph respectively.
import * as React from "react";

import { OcrReviewCard, type OcrValues } from "@/components/ui/ocr-review-card";
import { ReceiptDropzone, type ReceiptItem } from "@/components/ui/receipt-dropzone";
import { ReceiptViewer } from "@/components/ui/receipt-viewer";
import { Button } from "@/components/ui/button";
import { RECEIPT_MAX_BYTES, validateReceiptFile } from "@/lib/schemas/receipt";
import { Block, Group, Panel, Row } from "./shared";

/** A 1×1 PNG, so the specimens need no network and no fixtures on disk. */
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const SAMPLE: ReceiptItem[] = [
  { id: "r1", fileName: "indigo-boarding-pass.jpg", mimeType: "image/jpeg", url: PIXEL },
  { id: "r2", fileName: "taj-bengal-invoice.pdf", mimeType: "application/pdf", url: "" },
];

const REJECTIONS = [
  { name: "scan.tiff", type: "image/tiff", size: 2_000_000 },
  { name: "huge-photo.jpg", type: "image/jpeg", size: 12 * 1024 * 1024 },
  { name: "empty.pdf", type: "application/pdf", size: 0 },
  { name: "receipt.jpg", type: "image/jpeg", size: 900_000 },
];

export function ReceiptSection() {
  const [receipts, setReceipts] = React.useState<ReceiptItem[]>(SAMPLE);
  const [viewing, setViewing] = React.useState<ReceiptItem | null>(null);
  const [ocrValues, setOcrValues] = React.useState<OcrValues>({
    amount: "1450.00",
    merchant: "IndiGo",
    date: "2026-08-12",
  });

  /** A fake upload that takes a visible second, so progress is watchable. */
  async function fakeUpload(files: File[], onProgress: (f: number) => void) {
    for (let i = 1; i <= 10; i += 1) {
      await new Promise((r) => setTimeout(r, 90));
      onProgress(i / 10);
    }
    setReceipts((prev) => [
      ...prev,
      ...files.map((f, i) => ({
        id: `new-${Date.now()}-${i}`,
        fileName: f.name,
        mimeType: f.type,
        url: f.type === "application/pdf" ? "" : PIXEL,
      })),
    ]);
  }

  return (
    <Group
      id="receipt"
      eyebrow="§6.2"
      title="Receipt capture"
      description="Drag-and-drop on desktop, the camera on a phone, a thumbnail grid you can remove from, and an OCR card that treats failure as the ordinary event it is."
    >
      <Block
        title="ReceiptDropzone"
        description="Drop a file on it. Drag-over fills accent-subtle over 100ms and dashes the accent border — colour only, because a target that grows as you approach it is a target that moves."
      >
        <Panel>
          <ReceiptDropzone
            receipts={receipts}
            onUpload={fakeUpload}
            onRemove={async (id) => {
              setReceipts((prev) => prev.filter((r) => r.id !== id));
            }}
            onOpen={setViewing}
          />
          <Row label="Reset">
            <Button size="sm" variant="secondary" onClick={() => setReceipts(SAMPLE)}>
              Restore samples
            </Button>
          </Row>
          <p className="text-meta text-text-tertiary">
            The progress bar lives in reserved space — a 4px strip that is
            always in the layout — so starting an upload moves nothing.
            Pending files take their grid slot immediately, so the tile doesn&apos;t
            jump in when the upload lands. The bar animates{" "}
            <code>scaleX</code>, a transform, rather than width.
          </p>
        </Panel>

        <Panel title="Read-only — a submitted expense">
          <ReceiptDropzone receipts={SAMPLE} onUpload={fakeUpload} readOnly />
        </Panel>

        <Panel title="File rules, decided once">
          <div className="border-line overflow-hidden rounded-lg border">
            <table className="w-full text-body">
              <thead className="bg-bg-subtle text-text-secondary text-label">
                <tr>
                  <th className="p-3 text-left font-medium">File</th>
                  <th className="p-3 text-left font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {REJECTIONS.map((file) => {
                  const problem = validateReceiptFile(file);
                  return (
                    <tr key={file.name}>
                      <td className="text-text-primary p-3">
                        {file.name}{" "}
                        <span className="text-text-tertiary text-meta tabular">
                          ({Math.round(file.size / 1024)} KB)
                        </span>
                      </td>
                      <td
                        className={`p-3 text-meta ${
                          problem ? "text-status-danger-text" : "text-status-success-text"
                        }`}
                      >
                        {problem ?? "Accepted"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-meta text-text-tertiary">
            These verdicts come from <code>validateReceiptFile</code> — the same
            pure function <code>POST /api/receipts</code> uses. Checking in the
            browser isn&apos;t security; the route still validates. It is the
            difference between being told immediately and being told after
            uploading {Math.round(RECEIPT_MAX_BYTES / (1024 * 1024))} MB.
          </p>
        </Panel>
      </Block>

      <Block
        title="OCRReviewCard"
        description="Editable fields, not a preview — correcting a wrong guess in place beats accepting it and then hunting for the field to fix. One primary action, because the reader is asserting one thing: this looks right."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Read successfully">
            <OcrReviewCard
              values={ocrValues}
              onChange={(field, value) =>
                setOcrValues((prev) => ({ ...prev, [field]: value }))
              }
              onAccept={() => undefined}
              onDismiss={() => undefined}
            />
          </Panel>

          <Panel title="Low confidence — the capability, not yet the reality">
            <OcrReviewCard
              values={{ amount: "1450.00", merchant: "1ND1G0", date: "2026-08-12" }}
              confidence={{ merchant: "low", amount: "low" }}
              onChange={() => undefined}
              onAccept={() => undefined}
            />
            <p className="text-meta text-status-warning-text">
              Nothing passes <code>confidence</code> today. lib/ocr&apos;s
              OcrResult is <code>{"{merchant?, date?, amount?}"}</code> with no
              confidence attached, and deriving one from field length or
              roundness would be a guess wearing a warning colour. The underline
              lights up the day the OCR layer reports confidence — a change in
              lib/ocr, not in this component.
            </p>
          </Panel>

          <Panel title="Couldn't read it — the expected case" className="lg:col-span-2">
            <OcrReviewCard values={{}} onChange={() => undefined} onAccept={() => undefined} />
            <p className="text-meta text-text-tertiary">
              No danger token, no alert icon, no apology. lib/ocr resolves to{" "}
              <code>{"{}"}</code> for every PDF and every unreadable photo, so
              this is an ordinary Tuesday rather than a failure. Styling an
              expected outcome as an error trains people to ignore real errors.
            </p>
          </Panel>
        </div>
      </Block>

      <Block
        title="ReceiptViewer"
        description="Zoom, rotate, download. Rotate earns its place: a receipt photographed on a table lands sideways about half the time, and re-shooting it is exactly the friction the capture flow exists to remove."
      >
        <Panel>
          <Row label="Open one">
            {SAMPLE.map((receipt) => (
              <Button
                key={receipt.id}
                size="sm"
                variant="secondary"
                onClick={() => setViewing(receipt)}
              >
                {receipt.fileName}
              </Button>
            ))}
          </Row>
          <p className="text-meta text-text-tertiary">
            Zoom and rotate are transforms, so they cost nothing to animate and
            reduced motion loses only the easing, never the ability to rotate.
            The image scales inside a fixed-height frame rather than resizing
            the dialog and shoving the controls off-screen. A PDF gets the
            browser&apos;s own viewer, which already has paging, zoom and text
            selection — reimplementing that badly would be worse than not
            having it.
          </p>
        </Panel>
      </Block>

      <ReceiptViewer receipt={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </Group>
  );
}
