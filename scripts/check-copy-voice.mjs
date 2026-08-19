// Copy voice check (D5.1).
//
// The D5.1 brief names a voice: "direct, no apologies, no exclamation marks,
// never blames the user". That is easy to agree with and easy to drift from —
// the first "Oops! Something went wrong" arrives on a Friday, in a component
// nobody reviews, and then it is precedent.
//
// So it is checked. This scans the props that CARRY user-facing copy —
// EmptyState / ErrorState headlines and descriptions, and the toast helpers —
// rather than every string in the codebase, because a blanket scan would flag
// aria labels, test fixtures and the word "important" in a comment, and a
// checker that cries wolf gets switched off.
//
// Run by `npm run lint`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components"];
const EXT = /\.tsx?$/;

/** Props whose string value is read by a human on screen. */
const COPY_PROPS = ["headline", "description", "emptyMessage", "confirmLabel", "title"];

const RULES = [
  {
    id: "no-exclamation",
    test: (s) => /!/.test(s),
    why: "no exclamation marks — urgency the reader didn't ask for",
  },
  {
    id: "no-apology",
    test: (s) => /\b(sorry|oops|whoops|apolog)/i.test(s),
    why: "no apologies — say what happened and what to do",
  },
  {
    id: "no-blame",
    test: (s) =>
      /\byou (?:failed|forgot|didn't|did not|must not|should have)\b/i.test(s),
    why: "never blames the reader",
  },
  {
    id: "no-empty-please",
    test: (s) => /\bplease try again\b/i.test(s),
    why: "\"please try again\" is an apology in a politeness costume — say what to try",
  },
  {
    id: "no-something-went-wrong",
    test: (s) => /\bsomething went wrong\b/i.test(s),
    why: "names nothing the reader didn't already know — say WHAT failed",
  },
];

/** Matches `headline="..."` and `description="..."` with a literal string. */
const PROP_RE = new RegExp(
  `\\b(${COPY_PROPS.join("|")})=(?:"([^"]*)"|\\{"([^"]*)"\\})`,
  "g"
);

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
    // The design-system gallery quotes bad copy deliberately, to show what
    // the rules are FOR. Exempting it is the difference between a checker
    // and a gag order.
    if (file.includes(`design-system`)) continue;

    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(PROP_RE)) {
      const value = match[2] ?? match[3] ?? "";
      if (value.length < 3) continue;
      for (const rule of RULES) {
        if (rule.test(value)) {
          const line = source.slice(0, match.index).split("\n").length;
          problems.push({ file, line, value, rule });
        }
      }
    }
  }
}

// Also hold the shared copy constants to the same voice — they are the
// wording the whole app falls back to.
// Comments are stripped first: they DISCUSS bad copy ("\"sorry\" is an
// apology") and flagging the explanation of a rule is how a checker gets
// switched off.
const errorsSource = readFileSync(join("lib", "errors.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
for (const match of errorsSource.matchAll(/"([^"\n]{8,})"/g)) {
  for (const rule of RULES) {
    if (rule.test(match[1])) {
      const line = errorsSource.slice(0, match.index).split("\n").length;
      problems.push({ file: "lib/errors.ts", line, value: match[1], rule });
    }
  }
}

if (problems.length > 0) {
  console.error("✖ copy voice (D5.1):\n");
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}`);
    console.error(`    "${p.value}"`);
    console.error(`    → ${p.rule.why}\n`);
  }
  process.exit(1);
}

console.log("✔ copy voice: no apologies, exclamations or blame in user-facing copy");
