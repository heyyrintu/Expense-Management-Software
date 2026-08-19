#!/usr/bin/env node
// Design-token lint (D0.1). Runs as part of `npm run lint`.
//
// Two rules, enforced across app/** and components/**:
//   1. NO RAW HEX COLOURS. Every colour comes from the token layer in
//      app/globals.css. A hex in a component means the dark theme will not
//      follow it and the value can never be changed centrally.
//   2. NO ARBITRARY TAILWIND VALUES for design decisions — `text-[13px]`,
//      `p-[7px]`, `w-[240px]`. If a value is worth using, it is worth naming.
//
// What is NOT flagged: Tailwind VARIANTS, which use the same bracket syntax
// but express a condition rather than a value — `data-[state=open]`,
// `group-data-[disabled=true]`, `has-[>svg]`, `aria-[expanded=true]`,
// `supports-[display:grid]`, `peer-[...]`, `not-[...]`, `@[...]`, and
// property lists like `transition-[color,box-shadow]`.
//
// ── EXCEPTION PROCESS ─────────────────────────────────────────────────────
// Prefer, in order:
//   1. Use an existing token (DESIGN-PRD §5 — it is probably already named).
//   2. Add the token to app/globals.css with a comment explaining what it is
//      for. That is the sanctioned path and needs no entry here.
//   3. Only if a value must stay local and un-tokenised, add it to
//      ALLOWED_EXCEPTIONS below with: the file, the exact pattern, a reason,
//      and the task that removes it. Entries without an owner get deleted.
// ──────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components"];
const EXTENSIONS = [".ts", ".tsx", ".css"];

/** Files where the token layer itself lives — literals are the point there. */
const TOKEN_SOURCES = ["app/globals.css"];

// Empty on purpose. The D0.1 ring-[3px] exception was retired in D0.3 when
// the primitives were restyled to the 2px spec ring.
const ALLOWED_EXCEPTIONS = [];

/**
 * Directories where TAILWIND PALETTE COLOURS are banned as well — bg-red-50,
 * text-green-800 and friends. These bypass the token layer just as surely as
 * a raw hex: they don't follow the theme and can't be changed centrally.
 *
 * Scope grows as screens are restyled. Feature screens still carry palette
 * classes from before the design system existed; D1–D5 clear them screen by
 * screen and add each directory here as it lands.
 */
const TOKEN_ONLY_DIRS = ["components/ui", "components/status-badge.tsx", "components/sla-badge.tsx"];

const PALETTE_COLOUR =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|shadow|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/;

const HEX = /#[0-9a-fA-F]{3,8}\b/;
// A bracket preceded by a utility stem. Variants are filtered separately.
const ARBITRARY = /(?:^|[\s"'`:])(-?[a-z][a-z0-9]*(?:-[a-z0-9]+)*)-\[([^\]]+)\]/g;

const VARIANT_STEMS = new Set([
  "data", "group-data", "peer-data", "aria", "group-aria", "peer-aria",
  "has", "group-has", "peer-has", "not", "supports", "in", "nth", "nth-last",
  "group", "peer", "where", "is",
]);

/** Property lists (`transition-[color,box-shadow]`) name properties, not values. */
function isPropertyList(stem, value) {
  return (
    (stem === "transition" || stem === "will-change") &&
    /^[a-z-]+(,[a-z-]+)*$/.test(value.replace(/\s/g, ""))
  );
}

/**
 * `content-['']` and friends carry a STRING, not a measurement — the empty
 * content marker that makes a pseudo-element render is structural.
 */
function isContentString(stem) {
  return stem === "content";
}

/**
 * Grid templates built purely from intrinsic keywords — `grid-cols-[1fr_auto]`
 * — describe a relationship between columns, not a measurement. A template
 * containing a LENGTH (`grid-cols-[240px_1fr]`) is a design value and is
 * still flagged: that 240px belongs in the token layer.
 */
function isIntrinsicGridTemplate(stem, value) {
  if (stem !== "grid-cols" && stem !== "grid-rows") return false;
  return /^(?:(?:minmax\()?(?:\d+fr|auto|min-content|max-content)\)?[_\s]*)+$/.test(
    value.trim()
  );
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, out);
    } else if (EXTENSIONS.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function isExcepted(relPath, line) {
  return ALLOWED_EXCEPTIONS.some(
    (ex) => relPath.split(sep).join("/").startsWith(ex.file) && ex.pattern.test(line)
  );
}

const violations = [];

for (const dir of SCAN_DIRS) {
  let files;
  try {
    files = walk(join(ROOT, dir));
  } catch {
    continue; // directory absent — nothing to check
  }

  for (const file of files) {
    const relPath = relative(ROOT, file).split(sep).join("/");
    if (TOKEN_SOURCES.includes(relPath)) continue;

    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const at = `${relPath}:${i + 1}`;
      if (isExcepted(relPath, line)) return;

      const inTokenOnlyDir = TOKEN_ONLY_DIRS.some((d) => relPath.startsWith(d));
      if (inTokenOnlyDir) {
        const palette = PALETTE_COLOUR.exec(line);
        if (palette) {
          violations.push({
            at,
            rule: "palette-colour",
            found: palette[0],
            hint: "Primitives are token-only. Use bg-*/text-*/accent-*/status-* from the token layer.",
          });
        }
      }

      const hex = HEX.exec(line);
      if (hex) {
        violations.push({
          at,
          rule: "raw-hex",
          found: hex[0],
          hint: "Use a colour token (bg-*, text-*, accent-*, status-*). Add one to app/globals.css if it is missing.",
        });
      }

      ARBITRARY.lastIndex = 0;
      let m;
      while ((m = ARBITRARY.exec(line)) !== null) {
        const [, stem, value] = m;
        if (VARIANT_STEMS.has(stem)) continue;
        if (isPropertyList(stem, value)) continue;
        if (isIntrinsicGridTemplate(stem, value)) continue;
        if (isContentString(stem)) continue;
        violations.push({
          at,
          rule: "arbitrary-value",
          found: `${stem}-[${value}]`,
          hint: "Use a scale value (spacing 1–16, text-body/label/meta, rounded-sm/md/lg) or name a new token.",
        });
      }
    });
  }
}

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} design-token violation${violations.length === 1 ? "" : "s"}\n`);
  for (const v of violations) {
    console.error(`  ${v.at}`);
    console.error(`    ${v.rule}: ${v.found}`);
    console.error(`    ${v.hint}\n`);
  }
  console.error(
    "Tokens live in app/globals.css (DESIGN-PRD §5). The exception process is\n" +
      "documented at the top of scripts/check-design-tokens.mjs.\n"
  );
  process.exit(1);
}

console.log("✔ design tokens: no raw hex or arbitrary values in app/** or components/**");
