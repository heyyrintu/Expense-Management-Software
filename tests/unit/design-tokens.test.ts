import { describe, expect, it } from "vitest";
import {
  BRAND_FILL_PAIRS,
  COLOR_GROUPS,
  CONTRAST_CONTRACT,
  MOTION_TOKENS,
  RADIUS_SCALE,
  SPACING_SCALE,
  TYPE_SCALE,
  contrastLevel,
  contrastRatio,
  hexToRgb,
  relativeLuminance,
} from "@/lib/design/tokens";

describe("contrast maths", () => {
  it("parses 3- and 6-digit hex", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("6366F1")).toEqual({ r: 99, g: 102, b: 241 });
    expect(() => hexToRgb("nope")).toThrow();
    expect(() => hexToRgb("#12345")).toThrow();
  });

  it("matches the WCAG reference luminances", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#808080")).toBeCloseTo(0.2158, 3);
  });

  it("computes known contrast ratios", () => {
    // The canonical extremes and a well-known pair.
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 1);
  });

  it("is symmetric — order of the pair doesn't matter", () => {
    expect(contrastRatio("#18181B", "#FAFAFA")).toBe(contrastRatio("#FAFAFA", "#18181B"));
  });

  it("grades against the WCAG thresholds", () => {
    expect(contrastLevel(21)).toBe("AAA");
    expect(contrastLevel(7)).toBe("AAA");
    expect(contrastLevel(6.99)).toBe("AA");
    expect(contrastLevel(4.5)).toBe("AA");
    expect(contrastLevel(4.49)).toBe("AA Large");
    expect(contrastLevel(2.99)).toBe("Fail");
  });
});

describe("the PRD contrast contract holds", () => {
  it("every documented pair clears 4.5:1", () => {
    const failures = CONTRAST_CONTRACT.filter(
      (pair) => contrastRatio(pair.foreground, pair.background) < 4.5
    ).map((pair) => `${pair.label} = ${contrastRatio(pair.foreground, pair.background)}`);
    expect(failures).toEqual([]);
  });

  it("covers the pairs the PRD calls out by name", () => {
    const labels = CONTRAST_CONTRACT.map((p) => p.label);
    expect(labels).toContain("text-secondary on bg-subtle");
    expect(labels.filter((l) => l.startsWith("status-"))).toHaveLength(5);
  });

  it("holds the brand fills to the 3:1 non-text minimum", () => {
    for (const pair of BRAND_FILL_PAIRS) {
      const ratio = contrastRatio(pair.foreground, pair.background);
      expect(ratio, `${pair.label} = ${ratio}`).toBeGreaterThanOrEqual(3);
      expect(pair.note.length).toBeGreaterThan(0);
    }
  });

  it("records why each brand fill needs a darker text shade", () => {
    // The gap this documents is real: these are the measured ratios, and
    // five of the eight would fail as small text. The laurel accent pairs
    // (N0.1) left this list — the base clears AA outright — and the gilt
    // fill joined it.
    const belowAa = BRAND_FILL_PAIRS.filter(
      (p) => contrastRatio(p.foreground, p.background) < 4.5
    ).map((p) => p.label);
    expect(belowAa).toEqual([
      "gilt on its subtle",
      "status-success on its subtle",
      "status-warning on its subtle",
      "status-danger on its subtle",
      "status-neutral on its subtle",
    ]);
  });
});

describe("token registry integrity", () => {
  it("has unique token names and valid hex values", () => {
    const names = COLOR_GROUPS.flatMap((g) => g.tokens.map((t) => t.name));
    expect(new Set(names).size).toBe(names.length);
    for (const group of COLOR_GROUPS) {
      for (const token of group.tokens) {
        expect(token.hex).toMatch(/^#[0-9A-F]{6}$/i);
        expect(token.cssVar.startsWith("--")).toBe(true);
        expect(token.usage.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the type scale ordered and on-spec", () => {
    const sizes = TYPE_SCALE.map((t) => t.size);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
    // §5.3 sizes, plus eyebrow (N0.3) and micro for counter badges.
    expect(sizes).toEqual([32, 24, 18, 15, 14, 14, 13, 12, 11, 10]);
    for (const t of TYPE_SCALE) {
      expect(t.lineHeight).toBeGreaterThan(t.size);
    }
  });

  it("keeps spacing on the 4px grid", () => {
    for (const s of SPACING_SCALE) {
      expect(s.px % 4).toBe(0);
      expect(Number(s.step) * 4).toBe(s.px);
    }
  });

  it("exposes exactly four radii and the four motion durations", () => {
    expect(RADIUS_SCALE.map((r) => r.name)).toEqual(["sm", "md", "lg", "full"]);
    const durations = MOTION_TOKENS.filter((m) => m.value.endsWith("ms"));
    expect(durations.map((d) => d.name)).toEqual(["instant", "fast", "base", "slow"]);
    // 300ms is the hard ceiling (§5.6).
    for (const d of durations) {
      expect(Number.parseInt(d.value, 10)).toBeLessThanOrEqual(300);
    }
  });
});
