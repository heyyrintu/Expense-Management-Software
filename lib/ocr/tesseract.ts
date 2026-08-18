// Tesseract.js implementation. First run downloads the eng traineddata
// (~15 MB) — subsequent runs use the on-disk cache. Callers (lib/ocr/index)
// handle timeouts and failures; this module just recognizes text.
import type { Worker } from "tesseract.js";

const globalForOcr = globalThis as unknown as {
  ocrWorker?: Promise<Worker>;
};

async function getWorker(): Promise<Worker> {
  if (!globalForOcr.ocrWorker) {
    globalForOcr.ocrWorker = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("eng");
    })();
  }
  return globalForOcr.ocrWorker;
}

export async function extractWithTesseract(buffer: Buffer): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data.text ?? "";
}
