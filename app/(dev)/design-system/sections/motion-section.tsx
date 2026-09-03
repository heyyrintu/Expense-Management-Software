"use client";

// Motion demos (D0.2) for the design-system gallery.
//
// Each demo replays the real variant from lib/motion.ts — nothing here
// redefines a duration or a curve, so what you see is what ships. Replay is
// deliberately spammable: every variant must survive being interrupted
// mid-flight, and clicking fast is how you check.
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  collapseRow,
  fadeScale,
} from "@/lib/motion";

function Demo({
  title,
  usage,
  note,
  children,
  onReplay,
}: {
  title: string;
  usage: string;
  note?: string;
  children: React.ReactNode;
  onReplay: () => void;
}) {
  return (
    <div className="border-line bg-bg-surface grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <code className="text-label text-text-primary">{title}</code>
          <span className="text-meta text-text-secondary">{usage}</span>
        </div>
        <Button size="sm" variant="outline" onClick={onReplay}>
          Replay
        </Button>
      </div>
      <div className="bg-bg-subtle grid min-h-32 place-items-center overflow-hidden rounded-md p-4">
        {children}
      </div>
      {note ? <p className="text-meta text-text-tertiary">{note}</p> : null}
    </div>
  );
}

function FadeScaleDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <Demo
      title="fadeScale"
      usage="Dropdowns, popovers, tooltips, dialog content"
      note="Scales from 0.96 with its origin at the trigger, so it grows out of the thing you clicked."
      onReplay={() => {
        setOpen(false);
        window.setTimeout(() => setOpen(true), 60);
      }}
    >
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="panel"
            variants={fadeScale}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ transformOrigin: "top center" }}
            className="border-line bg-bg-surface shadow-raised text-body text-text-secondary rounded-md border px-4 py-3"
          >
            Menu panel
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Demo>
  );
}


const ROWS = ["Blue Tokai — ₹450.00", "Indigo — ₹4,500.00", "Uber — ₹340.00"];

function CollapseRowDemo() {
  const [rows, setRows] = React.useState(ROWS);
  return (
    <Demo
      title="collapseRow"
      usage="A row leaving a list after an optimistic action"
      note="The one sanctioned exception to transform/opacity-only: height animates so the rows below close the gap. Opacity leads it out."
      onReplay={() => setRows(ROWS)}
    >
      <ul className="w-full max-w-72">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.li
              key={row}
              variants={collapseRow}
              initial="visible"
              animate="visible"
              exit="exit"
              className="overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setRows((r) => r.filter((x) => x !== row))}
                className="border-line hover:bg-bg-subtle text-body text-text-secondary flex w-full items-center justify-between border-b px-3 py-2 text-left"
              >
                <span>{row}</span>
                <span className="text-meta text-text-tertiary">Remove</span>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Demo>
  );
}


export function MotionDemos() {
  const reduced = useReducedMotion();
  return (
    <div className="grid gap-4">
      {reduced ? (
        <p className="border-status-warning-subtle bg-status-warning-subtle text-status-warning-text text-body rounded-md border p-3">
          Your system asks for reduced motion, so these demos fade without
          moving. That is the intended behaviour — nothing below is broken.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <FadeScaleDemo />
        <CollapseRowDemo />
      </div>
    </div>
  );
}
