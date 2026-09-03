// The symbol companion font (app/fonts/inter-symbols.woff2) exists so that a
// rupee sign costs a kilobyte instead of the 109 KB of latin-ext that
// next/font/google fetched for it. This test keeps that true:
//   - the companion is present, is WOFF2, and is tiny;
//   - GLYPHS still names every latin-ext character the app renders, so a
//     new currency sign cannot quietly fall back to the system font;
//   - both font stacks list the companion straight after Inter.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { GLYPHS } from "../../scripts/subset-symbol-fonts.mjs";

const root = join(__dirname, "..", "..");
const COMPANION = "app/fonts/inter-symbols.woff2";

/** Google Fonts' `latin-ext` unicode-range, as declared for Inter. */
const LATIN_EXT: Array<[number, number]> = [
  [0x0100, 0x02ba],
  [0x02bd, 0x02c5],
  [0x02c7, 0x02cc],
  [0x02ce, 0x02d7],
  [0x02dd, 0x02ff],
  [0x0304, 0x0304],
  [0x0308, 0x0308],
  [0x0329, 0x0329],
  [0x1d00, 0x1dbf],
  [0x1e00, 0x1e9f],
  [0x1ef2, 0x1eff],
  [0x2020, 0x2020],
  [0x20a0, 0x20ab],
  [0x20ad, 0x20c0],
  [0x2113, 0x2113],
  [0x2c60, 0x2c7f],
  [0xa720, 0xa7ff],
];

function isLatinExt(cp: number): boolean {
  return LATIN_EXT.some(([a, b]) => cp >= a && cp <= b);
}

/** Every .ts/.tsx under `dir`, excluding the gallery, which quotes anything. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "design-system" && entry.name !== "node_modules") sourceFiles(path, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

describe("symbol companion font", () => {
  it("names the rupee sign, the glyph that started this", () => {
    expect(GLYPHS).toContain("₹");
  });

  it("is a small WOFF2 file", () => {
    const path = join(root, COMPANION);
    const magic = readFileSync(path).subarray(0, 4).toString("ascii");
    expect(magic).toBe("wOF2");
    // The latin-ext face it is cut from is 85 KB; a companion past this has
    // started carrying something other than a handful of symbols.
    expect(statSync(path).size).toBeLessThan(5 * 1024);
  });

  it("covers every latin-ext glyph the UI renders", () => {
    // Rendered strings live in JSX and copy tables; comments are stripped so
    // a box-drawing rule in a header comment does not count as UI text.
    const files = ["app", "components", "lib"].flatMap((d) => sourceFiles(join(root, d)));
    const missing = new Set<string>();
    for (const file of files) {
      const src = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
      for (const ch of src) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp > 0x7f && isLatinExt(cp) && !GLYPHS.includes(ch)) missing.add(ch);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("is listed straight after Inter in both font stacks", () => {
    const css = readFileSync(join(root, "app/globals.css"), "utf8");
    expect(css).toMatch(/--font-sans:\s*var\(--font-inter\),\s*var\(--font-inter-symbols\)/);
    expect(css).toMatch(
      /--font-display:\s*var\(--font-bodoni\),\s*var\(--font-inter\),\s*var\(--font-inter-symbols\)/
    );
  });
});
