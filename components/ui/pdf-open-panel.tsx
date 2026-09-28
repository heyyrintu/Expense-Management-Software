// What a viewer shows in place of an embedded PDF.
//
// PDFs used to render inline: `<object>` for a tile's first page and
// `<iframe>` in ReceiptViewer and PaymentProofViewer. The per-request CSP
// (lib/security/csp.ts) blocks both — `object-src 'none'`, and frame-src falls
// back to `default-src 'self'` — because the files are presigned URLs on the
// storage host, not this origin. So the file opens in a NEW TAB instead, where
// the browser's own viewer runs under the storage response rather than this
// page's policy, with its paging, zoom and text selection intact.
//
// Deliberately calm: a PDF that opens elsewhere is ordinary, not an error, so
// no warning tokens and no apology.
import { ExternalLink, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PdfOpenPanel({ url, fileName }: { url: string; fileName: string }) {
  return (
    <div className="grid justify-items-center gap-3 px-6 text-center">
      <FileText aria-hidden="true" className="text-text-tertiary size-6" />
      <p className="text-body text-text-secondary">
        PDFs open in a new tab, in your browser&apos;s own viewer.
      </p>
      <Button asChild size="sm" variant="secondary">
        <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${fileName} in a new tab`}>
          <ExternalLink aria-hidden="true" className="size-4" />
          Open PDF
        </a>
      </Button>
    </div>
  );
}
