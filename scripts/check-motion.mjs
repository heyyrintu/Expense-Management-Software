// Motion rules check (D5.2) — DESIGN-PRD §4 principle 4, mechanised.
//
// The audit in docs/MOTION-AUDIT.md is a snapshot; this is what keeps it
// true. Every violation it catches is one that was actually in the codebase
// before D5.2, which is the argument for having it: the rules were written
// down, agreed with, and then broken three times anyway — quietly, in files
// nobody re-read.
//
// Run by `npm run lint`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components"];
const EXT = /\.tsx?$/;
const CEILING_MS = 300;

const RULES = [
  {
    id: "no-transition-all",
    test: (line) => /\btransition-all\b/.test(line),
    why:
      "`transition-all` animates every property that changes, including layout " +
      "ones you didn't mean. Name the property: transition-transform / -opacity / -colors.",
  },
  {
    id: "no-ease-in-out",
    test: (line) => /\bease-in-out\b/.test(line),
    why: "never ease-in-out for UI — enters use ease-out, exits use ease-in (§4.4)",
  },
  {
    id: "no-transition-shadow",
    test: (line) => /\btransition-shadow\b/.test(line),
    why:
      "box-shadow is outside transform-and-opacity: it repaints. Use a colour " +
      "transition for hover, and remember §4.2 allows a border OR a shadow.",
  },
  {
    id: "no-layout-transition",
    test: (line) => /\btransition-\[(?:width|height|top|left|right|bottom|margin)/.test(line),
    why: "layout properties reflow the page every frame — animate transform instead",
  },
  {
    id: "no-arbitrary-duration",
    test: (line) => /\bduration-\[/.test(line),
    why: "durations come from the token scale: duration-instant / -fast / -base / -slow",
  },
  {
    id: "duration-ceiling",
    test: (line) => {
      const match = line.match(/\bduration-(\d+)\b/);
      return match ? Number(match[1]) > CEILING_MS : false;
    },
    why: `${CEILING_MS}ms is the hard ceiling — anything longer feels broken (§4.4)`,
  },
  {
    id: "no-raw-framer-duration",
    // `duration: 0.45` in a Framer transition, rather than seconds(DURATION.x).
    //
    // Only SECONDS-shaped values are flagged (0.3 < v < 10). A toast's
    // `duration: 6000` is how long it STAYS on screen, not how long it
    // animates — a different quantity that the ceiling has no opinion about,
    // and flagging it would make this checker something people mute.
    test: (line) => {
      const match = line.match(/\bduration:\s*([\d.]+)\s*[,}]/);
      if (!match) return false;
      const value = Number(match[1]);
      return value > CEILING_MS / 1000 && value < 10;
    },
    why:
      `over the ${CEILING_MS}ms ceiling. Durations come from lib/motion.ts ` +
      "(`seconds(DURATION.base)`), never written inline.",
  },
];

/**
 * Lines exempted with a trailing `motion-ok:<reason>` comment.
 *
 * There are exactly two sanctioned exceptions in the app — `collapseRow`
 * animating height, and the skeleton/busy pulse running past the ceiling —
 * and both are argued where they live. The escape hatch requires a written
 * reason so a third one cannot be added silently.
 */
const EXEMPT = /motion-ok:/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      yield* walk(full);
    } else if (EXT.test(entry)) {
      yield full;
    }
  }
}

const problems = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    // JSX comments are stripped whole-file because they span lines, and they
    // are where the rules get EXPLAINED — a checker that flags its own
    // rationale is one people switch off.
    const lines = readFileSync(file, "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .split("\n");
    lines.forEach((line, i) => {
      // Comments discuss the rules — flagging the explanation of a rule is
      // how a checker gets switched off.
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
      if (EXEMPT.test(line)) return;
      for (const rule of RULES) {
        if (rule.test(code)) {
          problems.push({ file, line: i + 1, text: line.trim(), rule });
        }
      }
    });
  }
}

if (problems.length > 0) {
  console.error("✖ motion rules (§4 principle 4):\n");
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}`);
    console.error(`    ${p.text.slice(0, 100)}`);
    console.error(`    → ${p.rule.why}\n`);
  }
  process.exit(1);
}

console.log(
  "✔ motion: no transition-all, ease-in-out, layout transitions or over-ceiling durations"
);
