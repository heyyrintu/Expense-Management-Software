// Receipt file rules (PRD 6.2): JPG/PNG/PDF, ≤ 10 MB, multiple per expense.
// Pure — unit-tested in tests/unit/receipt-validation.test.ts.

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

export const RECEIPT_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

export type ReceiptFileMeta = { name: string; type: string; size: number };

/** Returns a user-facing error, or null when the file is acceptable. */
export function validateReceiptFile(file: ReceiptFileMeta): string | null {
  if (!(file.type in RECEIPT_MIME_TYPES)) {
    return "Only JPG, PNG, or PDF receipts are supported.";
  }
  if (file.size <= 0) return "That file looks empty.";
  if (file.size > RECEIPT_MAX_BYTES) {
    return "Receipts must be 10 MB or smaller.";
  }
  return null;
}

/** Filename made safe for storage keys and Content-Disposition. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, "_")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-100);
  return cleaned.length > 0 ? cleaned : "receipt";
}
