// Build the symbol-only companion fonts in app/fonts/.
//
// WHY THESE EXIST. Google Fonts splits Inter and Bodoni Moda into subsets and
// next/font/google preloads only `latin`. The rupee sign (U+20B9) is not in
// Google's latin range — it is in latin-ext — so the first "₹" on a page
// made the browser fetch the ENTIRE latin-ext face on top of the preloaded
// one: 84 KB for Inter and 25 KB for Bodoni, discovered late (after layout),
// on every screen of an app whose whole job is showing rupee amounts. On the
// mobile Lighthouse profile that was ~1.5 s between first paint and the
// paragraph Lighthouse counts as LCP.
//
// The fix is to self-host: app/layout.tsx loads the latin faces through
// next/font/local (same bytes Google served, now committed), and Inter gets
// a companion face that contains ONLY the glyphs this codebase uses from
// outside the latin range. That companion is what this script produces — a
// kilobyte instead of 109 KB.
//
// Only Inter gets one. globals.css resolves the rupee sign in a Bodoni hero
// amount from Inter on purpose, so the sign matches every other amount on
// the screen; Bodoni's own ₹ would be a second face inside one number.
//
// Input (committed, so the build is reproducible offline):
//   app/fonts/src/inter-latin-ext.woff2   Google Fonts, Inter, latin-ext
// Output:
//   app/fonts/inter-symbols.woff2
//
// Re-run when GLYPHS changes:  node scripts/subset-symbol-fonts.mjs
// tests/unit/font-symbols.test.ts asserts the output still covers GLYPHS and
// that no source file uses a latin-ext glyph the companion lacks.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every character this app renders that Google's `latin` subset lacks and
 * `latin-ext` has. Anything not listed here and not in latin falls through
 * to the system font — fine for a check mark, wrong for a currency sign.
 */
export const GLYPHS = "₹";

const JOBS = [["app/fonts/src/inter-latin-ext.woff2", "app/fonts/inter-symbols.woff2"]];

// Only regenerate when run directly. tests/unit/font-symbols.test.ts imports
// GLYPHS from this file and must not rewrite the font on every test run.
const runDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (runDirectly) {
  const { default: subsetFont } = await import("subset-font");
  for (const [from, to] of JOBS) {
    const input = readFileSync(join(root, from));
    const output = await subsetFont(input, GLYPHS, { targetFormat: "woff2" });
    writeFileSync(join(root, to), output);
    console.log(`${to}: ${output.length} bytes (from ${input.length}) for ${JSON.stringify(GLYPHS)}`);
  }
}
