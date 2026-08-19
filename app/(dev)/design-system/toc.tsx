import Link from "next/link";

/**
 * Table of contents (D0.5). Plain anchors, no scroll-spy, no JavaScript.
 *
 * A gallery this long needs a way in, but a highlighted "current section"
 * would be an animation that communicates nothing the browser's own scroll
 * position doesn't already — and this page exists to hold the project to that
 * standard, so it may as well hold itself to it first.
 */
export const GALLERY_SECTIONS = [
  { id: "tokens", label: "Tokens", note: "Colour, contrast, status map" },
  { id: "typography", label: "Typography", note: "Scale, specimens, tabular numerals" },
  { id: "money", label: "Money and dates", note: "Amount, DateCell, every edge case" },
  { id: "scales", label: "Spacing · Radius · Elevation", note: "The three short scales" },
  { id: "components", label: "Components", note: "Every primitive, every state" },
  { id: "shell", label: "App shell", note: "Sidebar, top bar, tab bar, page header" },
  { id: "table", label: "DataTable", note: "Sorting, selection, paging, card collapse" },
  { id: "filters", label: "FilterBar", note: "Search, dates, facets, URL state" },
  { id: "kpi", label: "StatCard and charts", note: "KPIs, delta chips, chart theme" },
  { id: "capture", label: "Capture flow", note: "AmountInput, policy chips, sticky bar" },
  { id: "receipt", label: "Receipt capture", note: "Dropzone, OCR card, viewer" },
  { id: "report", label: "Report builder", note: "Timeline, flag strip, submit dialog" },
  { id: "approval", label: "Approval queue", note: "Flagged-first rows, undo, decisions" },
  { id: "finance", label: "Finance and proof", note: "Batch review, progress, proof viewer" },
  { id: "dashboard", label: "Dashboards", note: "KPI strip, rank list, skeleton" },
  { id: "ledger", label: "Ledger", note: "Tally table, segmented control, export" },
  { id: "recon", label: "Reconciliation", note: "Buckets, match dialog, period lock" },
  { id: "complaints", label: "Complaints", note: "SLA, thread, status crossfade" },
  { id: "domain", label: "Domain components", note: "Status, flags, charts — and what's missing" },
  { id: "motion", label: "Motion", note: "Tokens and replayable variants" },
  { id: "patterns", label: "Patterns", note: "Empty, loading, error" },
] as const;

export function TableOfContents() {
  return (
    <nav aria-label="Sections" className="lg:sticky lg:top-16">
      <h2 className="text-meta text-text-tertiary pb-2 uppercase">Contents</h2>
      <ul className="grid gap-1">
        {GALLERY_SECTIONS.map((section) => (
          <li key={section.id}>
            <Link
              href={`#${section.id}`}
              className="text-text-secondary hover:bg-bg-subtle hover:text-text-primary grid rounded-md px-3 py-2 transition-colors duration-instant ease-out outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
            >
              <span className="text-label">{section.label}</span>
              <span className="text-meta text-text-tertiary">{section.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
