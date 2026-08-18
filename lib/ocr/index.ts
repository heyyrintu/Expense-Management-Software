// OCR interface (CLAUDE.md): extractReceipt(file) -> {merchant?, date?, amount?}
// Contract: NEVER throws and never blocks expense creation — failures,
// unsupported types, and timeouts all resolve to {}.
import { extractWithTesseract } from "./tesseract";
import { parseReceiptText } from "./parse";

export type OcrResult = {
  merchant?: string;
  /** yyyy-mm-dd */
  date?: string;
  /** integer minor units */
  amount?: number;
};

export type OcrInput = { buffer: Buffer; mimeType: string };

const OCR_TIMEOUT_MS = 20_000;
const OCR_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export async function extractReceipt(input: OcrInput): Promise<OcrResult> {
  if (!OCR_MIME_TYPES.has(input.mimeType)) return {}; // PDFs: manual entry
  try {
    const text = await Promise.race([
      extractWithTesseract(input.buffer),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), OCR_TIMEOUT_MS)
      ),
    ]);
    if (!text) return {};
    return parseReceiptText(text);
  } catch {
    return {}; // graceful failure — user enters values manually
  }
}
