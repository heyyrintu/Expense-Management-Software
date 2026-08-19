"use client";

// Full-size receipt viewer (D2.2) — zoom, rotate, download.
//
// Rotate earns its place: a receipt photographed on a table lands sideways
// about as often as not, and re-shooting it is exactly the friction §2.1 is
// trying to remove. Zoom earns its place because the number you need is
// printed in 6pt on thermal paper.
//
// Both are TRANSFORMS (§4.4), so they cost nothing to animate and reduced
// motion loses only the easing, never the ability to rotate.
import * as React from "react";
import { Download, Minus, Plus, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ReceiptItem } from "./receipt-dropzone";

const ZOOM_STEPS = [1, 1.5, 2, 3] as const;

export function ReceiptViewer({
  receipt,
  onOpenChange,
}: {
  /** null closes the viewer. */
  receipt: ReceiptItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [zoomIndex, setZoomIndex] = React.useState(0);
  const [rotation, setRotation] = React.useState(0);

  // Every receipt opens fresh. Inheriting the previous one's 3× zoom and 180°
  // rotation would be a small mystery every single time.
  React.useEffect(() => {
    setZoomIndex(0);
    setRotation(0);
  }, [receipt?.id]);

  if (!receipt) return null;
  const isPdf = receipt.mimeType === "application/pdf";
  const zoom = ZOOM_STEPS[zoomIndex];

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-3">
        <DialogTitle className="truncate pr-8">{receipt.fileName}</DialogTitle>
        <DialogDescription className="sr-only">
          Full-size receipt. Use the controls to zoom, rotate or download it.
        </DialogDescription>

        {/* The image sits in a fixed-height, overflow-hidden frame, so zooming
            scales the picture inside its box rather than resizing the dialog
            and shoving the controls off-screen. */}
        <div className="border-line bg-bg-subtle grid h-96 place-items-center overflow-auto rounded-lg border">
          {isPdf ? (
            // A PDF gets the browser's own viewer, which already has paging,
            // its own zoom and text selection. Reimplementing that badly
            // would be worse than not having it.
            <iframe
              src={receipt.url}
              title={`Receipt ${receipt.fileName}`}
              className="h-full w-full"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={receipt.url}
              alt={`Receipt ${receipt.fileName}`}
              style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}
              className={cn(
                "max-h-full max-w-full object-contain",
                "transition-transform duration-fast ease-out"
              )}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {!isPdf ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={zoomIndex === 0}
                  onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
                  aria-label="Zoom out"
                >
                  <Minus aria-hidden="true" className="size-4" />
                </Button>
                <span className="text-meta text-text-tertiary tabular w-10 text-center">
                  {zoom}×
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={zoomIndex === ZOOM_STEPS.length - 1}
                  onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
                  aria-label="Zoom in"
                >
                  <Plus aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  aria-label="Rotate 90 degrees"
                >
                  <RotateCw aria-hidden="true" className="size-4" />
                </Button>
              </>
            ) : null}
          </div>

          <Button asChild size="sm" variant="secondary">
            {/* `download` on a cross-origin signed URL is advisory, so this
                may open rather than save depending on the storage response
                headers. Either way the file is reachable, which is the point. */}
            <a href={receipt.url} download={receipt.fileName} target="_blank" rel="noreferrer">
              <Download aria-hidden="true" className="size-4" />
              Download
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
