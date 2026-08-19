"use client";

// Receipt capture on the expense detail screen (D2.2).
//
// The UI is components/ui/receipt-dropzone + receipt-viewer; this file is
// only the wiring: the same POST /api/receipts and the same
// deleteReceiptAction as before, unchanged.
//
// XHR rather than fetch, for one reason: fetch cannot report upload progress.
// Same endpoint, same multipart body, same response — a different transport
// so the progress bar shows something true instead of an indeterminate
// spinner pretending to know.
import * as React from "react";
import { useRouter } from "next/navigation";

import { ReceiptDropzone, type ReceiptItem } from "@/components/ui/receipt-dropzone";
import { ReceiptViewer } from "@/components/ui/receipt-viewer";
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
  const [viewing, setViewing] = React.useState<ReceiptItem | null>(null);

  const items: ReceiptItem[] = receipts.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    mimeType: r.mimeType,
    url: r.url,
  }));

  async function upload(files: File[], onProgress: (fraction: number) => void) {
    const form = new FormData();
    form.set("expenseId", expenseId);
    for (const file of files) form.append("files", file);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/receipts");
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      });
      xhr.addEventListener("load", () => {
        try {
          const json = JSON.parse(xhr.responseText) as { ok: boolean; error?: string };
          if (json.ok) resolve();
          // The route's own copy, not a generic substitute — it already says
          // exactly which rule the file broke.
          else reject(new Error(json.error ?? "Upload failed. Try again."));
        } catch {
          reject(new Error("Upload failed. Try again."));
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Upload failed. Try again.")));
      xhr.addEventListener("abort", () => reject(new Error("Upload cancelled.")));
      xhr.send(form);
    });

    // The server ran OCR during the upload, so the review card upstream needs
    // the fresh read.
    router.refresh();
  }

  async function remove(receiptId: string) {
    const res = await deleteReceiptAction({ receiptId });
    if (!res.ok) throw new Error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <h2 className="text-label text-text-secondary">Receipts</h2>
      <ReceiptDropzone
        receipts={items}
        onUpload={upload}
        onRemove={readOnly ? undefined : remove}
        onOpen={setViewing}
        readOnly={readOnly}
      />
      <ReceiptViewer receipt={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </div>
  );
}
