// Contrast check (D5.3) — WCAG 2.1 AA, computed from the real token values.
//
// `lib/design/tokens.ts` already carries a CONTRAST_CONTRACT asserted in a
// unit test, but that list was hand-written and therefore only covers pairs
// somebody remembered. This script reads the tokens straight out of
// `app/globals.css` and checks EVERY foreground token against EVERY surface
// it is actually placed on — which is how D5.3 found that the app's most-used
// meta colour had never been measured.
//
// Thresholds (WCAG 2.1):
//   1.4.3  4.5:1 normal text · 3:1 large text (≥18.66px bold or ≥24px)
//   1.4.11 3:1 for UI component boundaries and meaningful graphics
//
// Run by `npm run lint`.
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");

/**
 * Pull `--name: #rrggbb;` out of the FIRST `:root` block.
 *
 * Bounded by brace depth rather than by a comment marker. It used to slice up
 * to the string "/* Dark theme hook", which meant deleting that block (D-9)
 * silently turned the end bound into -1 and swept the whole rest of the
 * stylesheet into the token set. A parser whose correctness depends on a
 * comment nobody knows is load-bearing is one edit away from being wrong.
 */
function readTokens() {
  const start = css.indexOf(":root {");
  if (start === -1) {
    console.error("✖ contrast: no :root block found in app/globals.css");
    process.exit(1);
  }
  let depth = 0;
  let end = start;
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const root = css.slice(start, end);
  const tokens = {};
  for (const m of root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[m[1]] = m[2].toUpperCase();
  }
  return tokens;
}

function luminance(hex) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const T = readTokens();

/** The three surfaces text is ever placed on. */
const SURFACES = ["bg-app", "bg-surface", "bg-subtle"];

/**
 * What each foreground token is FOR, and therefore which threshold applies.
 *
 * `text` — words a reader must read: 4.5:1.
 * `ui`   — borders, dots, bars, chart series: 3:1 (WCAG 1.4.11).
 * The distinction is the whole reason the `-text` shades exist alongside the
 * brand fills; see the note in app/globals.css.
 */
const PAIRS = [
  // ── Body and meta text on every surface ────────────────────────────────
  ...SURFACES.flatMap((bg) => [
    { fg: "fg-primary", bg, kind: "text" },
    { fg: "fg-secondary", bg, kind: "text" },
    { fg: "fg-tertiary", bg, kind: "text" },
    { fg: "accent-text-base", bg, kind: "text" },
  ]),

  // ── Status text on its own subtle background ───────────────────────────
  { fg: "status-success-text", bg: "status-success-subtle", kind: "text" },
  { fg: "status-warning-text", bg: "status-warning-subtle", kind: "text" },
  { fg: "status-danger-text", bg: "status-danger-subtle", kind: "text" },
  { fg: "status-info-text", bg: "status-info-subtle", kind: "text" },
  { fg: "status-neutral-text", bg: "status-neutral-subtle", kind: "text" },

  // Status text also appears on plain surfaces — a danger balance in a
  // ledger row, a warning line under a form field.
  ...["success", "warning", "danger", "info", "neutral"].flatMap((s) =>
    SURFACES.map((bg) => ({ fg: `status-${s}-text`, bg, kind: "text" }))
  ),

  // ── Text on filled surfaces ────────────────────────────────────────────
  { fg: "fg-on-accent", bg: "accent-solid-base", kind: "text" },
  { fg: "fg-on-accent", bg: "status-danger", kind: "text" },
  // The success fill carries a CHECK GLYPH, never words (the completed step
  // in a wizard). WCAG 1.4.11 governs icons at 3:1; the numerals on the
  // active step use accent-solid, which is checked as text above.
  { fg: "fg-on-accent", bg: "status-success", kind: "ui" },

  // ── Gilt (N0.2) — the ceremonial family from the Neoclassical redesign.
  // gilt-text carries words (the seal badge label, the wordmark rule's
  // caption); gilt-base is only ever a fill, a rule or a chart series, so
  // it is held to 1.4.11's 3:1 — including on its own subtle, where the
  // seal badge draws its border.
  ...SURFACES.map((bg) => ({ fg: "gilt-text", bg, kind: "text" })),
  { fg: "gilt-text", bg: "gilt-subtle", kind: "text" },
  { fg: "gilt-base", bg: "bg-surface", kind: "ui" },
  { fg: "gilt-base", bg: "bg-app", kind: "ui" },

  // ── UI boundaries and graphics: 3:1 (1.4.11) ───────────────────────────
  // line-strong is the control edge on every surface an input sits on —
  // N0.2 widened this from bg-surface alone after the limestone swap, so a
  // future neutral edit can't quietly fail on bg-subtle the way the first
  // limestone candidate did (2.98:1).
  { fg: "line-strong", bg: "bg-surface", kind: "ui" },
  { fg: "line-strong", bg: "bg-app", kind: "ui" },
  { fg: "line-strong", bg: "bg-subtle", kind: "ui" },
  { fg: "focus-ring-base", bg: "bg-surface", kind: "ui" },
  { fg: "focus-ring-base", bg: "bg-app", kind: "ui" },
  { fg: "focus-ring-base", bg: "bg-subtle", kind: "ui" },
  ...["success", "warning", "danger", "info", "neutral"].flatMap((s) =>
    SURFACES.map((bg) => ({ fg: `status-${s}`, bg, kind: "ui" }))
  ),
  { fg: "accent-base", bg: "bg-surface", kind: "ui" },
  { fg: "accent-base", bg: "bg-app", kind: "ui" },
];

const THRESHOLD = { text: 4.5, ui: 3 };

const rows = [];
const failures = [];

for (const pair of PAIRS) {
  const fg = T[pair.fg];
  const bg = T[pair.bg];
  if (!fg || !bg) {
    failures.push({ ...pair, missing: true });
    continue;
  }
  const value = ratio(fg, bg);
  const need = THRESHOLD[pair.kind];
  const row = { ...pair, fg, bg, value, need, pass: value >= need };
  rows.push(row);
  if (!row.pass) failures.push(row);
}

if (process.argv.includes("--table")) {
  for (const r of rows) {
    console.log(
      `| ${r.fg} on ${r.bg} | ${r.fg} | ${r.bg} | ${r.value.toFixed(2)}:1 | ${r.need}:1 | ${r.pass ? "✅" : "❌"} |`
    );
  }
}

if (failures.length > 0) {
  console.error("✖ contrast (WCAG 2.1 AA):\n");
  for (const f of failures) {
    if (f.missing) {
      console.error(`  ${f.fg} or ${f.bg} is not a token in :root\n`);
      continue;
    }
    console.error(
      `  ${f.fg} (${f.fg === undefined ? "?" : f.fg}) on ${f.bg}` +
        `\n    ${f.value.toFixed(2)}:1 — needs ${f.need}:1 (${f.kind})\n`
    );
  }
  process.exit(1);
}

console.log(`✔ contrast: ${rows.length} token pairs meet WCAG 2.1 AA`);
