// Design token registry (D0.1).
//
// globals.css is the runtime source of truth; this file is the same set of
// tokens described in TypeScript so tooling can reason about them — the
// /design-system gallery renders from here, and the contrast checker below
// verifies the PRD's ≥4.5:1 contract rather than trusting the prose.
//
// It lives in lib/ (not components/) precisely because it MUST hold literal
// hex values: it is the one place the token lint exempts by location.

export type ColorToken = {
  /** Tailwind class stem, e.g. "bg-app" is used as `bg-bg-app`. */
  name: string;
  /** CSS custom property in :root. */
  cssVar: string;
  /** Light-theme value. */
  hex: string;
  usage: string;
};

export type ColorGroup = {
  title: string;
  description: string;
  tokens: ColorToken[];
};

export const COLOR_GROUPS: ColorGroup[] = [
  {
    title: "Neutrals",
    description: "The interface itself — limestone surfaces, lines and warm ink (N0.1).",
    tokens: [
      { name: "bg-app", cssVar: "--bg-app", hex: "#F4F2ED", usage: "Page background — limestone" },
      { name: "bg-surface", cssVar: "--bg-surface", hex: "#FFFFFF", usage: "Cards, tables, sheets — the marble slab" },
      { name: "bg-subtle", cssVar: "--bg-subtle", hex: "#EDEAE3", usage: "Hover rows, inset panels, disabled fills" },
      { name: "line", cssVar: "--line", hex: "#E2DFD7", usage: "Default hairline" },
      { name: "line-strong", cssVar: "--line-strong", hex: "#878279", usage: "Inputs, focused containers — 3:1 control edge on every surface" },
      { name: "text-primary", cssVar: "--fg-primary", hex: "#1E1B16", usage: "Headings, amounts" },
      { name: "text-secondary", cssVar: "--fg-secondary", hex: "#54514A", usage: "Labels, body" },
      { name: "text-tertiary", cssVar: "--fg-tertiary", hex: "#6B675D", usage: "Meta, placeholders, timestamps — 4.5:1 (D5.3 rule)" },
    ],
  },
  {
    title: "Accent",
    description: "One accent — laurel green — used sparingly, always meaning “act here”.",
    tokens: [
      { name: "accent", cssVar: "--accent-base", hex: "#35604F", usage: "Primary buttons, links, active nav" },
      { name: "accent-hover", cssVar: "--accent-hover-base", hex: "#2C5142", usage: "Hover on accent surfaces" },
      { name: "accent-pressed", cssVar: "--accent-pressed-base", hex: "#244337", usage: "Active/pressed" },
      { name: "accent-subtle", cssVar: "--accent-subtle-base", hex: "#E9F0EA", usage: "Selected row, nav pill, badge background" },
      { name: "accent-border", cssVar: "--accent-border-base", hex: "#B9CEC2", usage: "Border on accent-subtle surfaces" },
      { name: "focus-ring", cssVar: "--focus-ring-base", hex: "#35604F", usage: "2px ring, 2px offset — always visible" },
      { name: "accent-solid", cssVar: "--accent-solid-base", hex: "#2F5747", usage: "Filled buttons carrying white text (AA)" },
      { name: "accent-text", cssVar: "--accent-text-base", hex: "#2F5747", usage: "Links and accent text (AA on subtle)" },
    ],
  },
  {
    title: "Gilt",
    description:
      "Bronze, ceremonial — money that is FINISHED. Three sanctioned uses only: the ledger closing balance, the Paid/Settled seal badge, the auth wordmark rule. Never buttons, never links, never nav.",
    tokens: [
      { name: "gilt", cssVar: "--gilt-base", hex: "#A5761F", usage: "Fills, rules, the one chart series — never small text (3:1 as a fill)" },
      { name: "gilt-text", cssVar: "--gilt-text", hex: "#7A5410", usage: "Glyphs on white, bg-app or gilt-subtle (AA)" },
      { name: "gilt-subtle", cssVar: "--gilt-subtle", hex: "#F6EFDD", usage: "Seal badge background" },
    ],
  },
  {
    title: "Status",
    description:
      "Semantic only, never decoration. Status is never colour alone — always colour plus a label.",
    tokens: [
      { name: "status-success", cssVar: "--status-success", hex: "#059669", usage: "Approved, reimbursed, matched" },
      { name: "status-success-subtle", cssVar: "--status-success-subtle", hex: "#ECFDF5", usage: "Success badge background" },
      { name: "status-warning", cssVar: "--status-warning", hex: "#C46A08", usage: "Policy flags, SLA amber, sent back" },
      { name: "status-warning-subtle", cssVar: "--status-warning-subtle", hex: "#FFFBEB", usage: "Warning badge background" },
      { name: "status-danger", cssVar: "--status-danger", hex: "#DC2626", usage: "Rejected, missing in bank, overdue" },
      { name: "status-danger-subtle", cssVar: "--status-danger-subtle", hex: "#FEF2F2", usage: "Danger badge background" },
      { name: "status-info", cssVar: "--status-info", hex: "#2563EB", usage: "Submitted, in review" },
      { name: "status-info-subtle", cssVar: "--status-info-subtle", hex: "#EFF6FF", usage: "Info badge background" },
      { name: "status-neutral", cssVar: "--status-neutral", hex: "#71717A", usage: "Draft, inactive" },
      { name: "status-neutral-subtle", cssVar: "--status-neutral-subtle", hex: "#F4F4F5", usage: "Neutral badge background" },
    ],
  },
  {
    title: "Status text",
    description:
      "The accessible foreground for each status on its subtle background. The brand shade above is a FILL — as small text it misses AA, so glyphs use these.",
    tokens: [
      { name: "status-success-text", cssVar: "--status-success-text", hex: "#047857", usage: "Text on success-subtle" },
      { name: "status-warning-text", cssVar: "--status-warning-text", hex: "#A84D08", usage: "Text on warning-subtle" },
      { name: "status-danger-text", cssVar: "--status-danger-text", hex: "#B91C1C", usage: "Text on danger-subtle" },
      { name: "status-info-text", cssVar: "--status-info-text", hex: "#1D4ED8", usage: "Text on info-subtle" },
      { name: "status-neutral-text", cssVar: "--status-neutral-text", hex: "#52525B", usage: "Text on neutral-subtle" },
    ],
  },
];

/** Status → token map (§5.2). StatusBadge is the ONLY consumer of this. */
export const STATUS_TOKEN_MAP = [
  { state: "Draft", token: "neutral", label: "Draft" },
  { state: "Submitted", token: "info", label: "Submitted" },
  { state: "In review", token: "info", label: "In review" },
  { state: "Approved", token: "success", label: "Approved" },
  { state: "Rejected", token: "danger", label: "Rejected" },
  { state: "Sent back", token: "warning", label: "Sent back" },
  { state: "Partially reimbursed", token: "warning", label: "Partly paid" },
  { state: "Reimbursed", token: "success", label: "Paid" },
  { state: "Policy flag", token: "warning", label: "Flagged" },
  { state: "Matched", token: "success", label: "Matched" },
  { state: "Missing in bank", token: "danger", label: "Not in bank" },
  { state: "Missing in app", token: "warning", label: "Not in app" },
] as const;

export type TypeToken = {
  name: string;
  className: string;
  size: number;
  lineHeight: number;
  weight: number;
  tracking: string;
  role: string;
  /** Which face carries the style. Absent = Inter (--font-sans); "display"
      = Bodoni Moda via the `font-display` utility (N0.3) — display, h1 and
      the auth wordmark only, never tabular data. */
  family?: "display";
};

export const TYPE_SCALE: TypeToken[] = [
  // display and h1 are the two Bodoni Moda styles (N0.3): the size utility
  // pairs with `font-display` at the call site — Tailwind's --text-*
  // namespace carries no family. Everything else is Inter.
  { name: "display", className: "text-display", size: 32, lineHeight: 38, weight: 700, tracking: "-0.01em", role: "Amount hero, ledger balance — Bodoni Moda", family: "display" },
  { name: "h1", className: "text-h1", size: 24, lineHeight: 32, weight: 700, tracking: "-0.005em", role: "Page title — Bodoni Moda", family: "display" },
  { name: "h2", className: "text-h2", size: 18, lineHeight: 26, weight: 600, tracking: "-0.01em", role: "Section heading" },
  { name: "h3", className: "text-h3", size: 15, lineHeight: 22, weight: 600, tracking: "0", role: "Card title" },
  { name: "body", className: "text-body", size: 14, lineHeight: 22, weight: 400, tracking: "0", role: "Body copy" },
  { name: "body-strong", className: "text-body-strong", size: 14, lineHeight: 22, weight: 600, tracking: "0", role: "Table amount, emphasis" },
  { name: "label", className: "text-label", size: 13, lineHeight: 18, weight: 500, tracking: "0", role: "Field label, caption" },
  { name: "meta", className: "text-meta", size: 12, lineHeight: 16, weight: 400, tracking: "0.01em", role: "Timestamp, meta" },
  { name: "eyebrow", className: "eyebrow", size: 11, lineHeight: 16, weight: 600, tracking: "0.14em", role: "Roman capitals above page titles and StatCard labels (uppercase via the eyebrow utility)" },
  { name: "micro", className: "text-micro", size: 10, lineHeight: 14, weight: 600, tracking: "0.02em", role: "Counter badges only" },
];

/** 4px base (§5.4). These are the only steps in use. */
export const SPACING_SCALE = [
  { step: "1", px: 4 },
  { step: "2", px: 8 },
  { step: "3", px: 12 },
  { step: "4", px: 16 },
  { step: "5", px: 20 },
  { step: "6", px: 24 },
  { step: "8", px: 32 },
  { step: "10", px: 40 },
  { step: "12", px: 48 },
  { step: "16", px: 64 },
] as const;

export const RADIUS_SCALE = [
  // One notch sharper across the scale (N0.1) — rectilinear neoclassicism.
  { name: "sm", className: "rounded-sm", px: "4px", usage: "Badges, inputs" },
  { name: "md", className: "rounded-md", px: "6px", usage: "Buttons, dropdowns" },
  { name: "lg", className: "rounded-lg", px: "8px", usage: "Cards, sheets" },
  { name: "full", className: "rounded-full", px: "9999px", usage: "Avatars, pills" },
] as const;

export const ELEVATION_SCALE = [
  { name: "flat", className: "shadow-flat", usage: "Cards, tables — border only, no shadow" },
  { name: "raised", className: "shadow-raised", usage: "Dropdowns, hover cards" },
  { name: "overlay", className: "shadow-overlay", usage: "Popovers, command palette" },
  { name: "modal", className: "shadow-modal", usage: "Modals (plus a 40% scrim)" },
] as const;

export const MOTION_TOKENS = [
  { name: "instant", cssVar: "--dur-instant", value: "100ms", usage: "Hover, focus, colour change" },
  { name: "fast", cssVar: "--dur-fast", value: "150ms", usage: "Dropdowns, tooltips, checkbox" },
  { name: "base", cssVar: "--dur-base", value: "200ms", usage: "Modals, toasts, tab switches" },
  { name: "slow", cssVar: "--dur-slow", value: "300ms", usage: "Sheets, page transitions — the ceiling" },
  { name: "ease-out", cssVar: "--ease-enter", value: "cubic-bezier(0.16, 1, 0.3, 1)", usage: "Every enter" },
  { name: "ease-in", cssVar: "--ease-exit", value: "cubic-bezier(0.4, 0, 1, 1)", usage: "Every exit" },
] as const;

// ---------------------------------------------------------------------------
// Contrast — WCAG 2.1 relative luminance
// ---------------------------------------------------------------------------

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG relative luminance (sRGB, gamma-corrected). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio, 1–21, rounded to 2dp. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const [light, dark] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

/**
 * The two backgrounds every colour token is measured against in the gallery
 * (D0.5): the surface it will most often sit on, and the ink that will most
 * often sit on it. Together they answer "can this hold text, and can text
 * hold it" for any swatch without hunting through the contrast contract.
 */
export const REFERENCE_COLORS = {
  surface: "#FFFFFF",
  textPrimary: "#1E1B16",
} as const;

export type ContrastLevel = "AAA" | "AA" | "AA Large" | "Fail";

/** Grade a ratio for normal-size text (the only size we make claims about). */
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

export type ContrastPair = {
  label: string;
  foreground: string;
  background: string;
};

/**
 * Every pair where a TOKEN CARRIES TEXT. All of these must clear 4.5:1 —
 * asserted in tests/unit/design-tokens.test.ts, so a token edit that breaks
 * accessibility fails the build rather than shipping.
 */
export const CONTRAST_CONTRACT: ContrastPair[] = [
  { label: "text-primary on bg-app", foreground: "#1E1B16", background: "#F4F2ED" },
  { label: "text-primary on bg-surface", foreground: "#1E1B16", background: "#FFFFFF" },
  { label: "text-secondary on bg-surface", foreground: "#54514A", background: "#FFFFFF" },
  { label: "text-secondary on bg-subtle", foreground: "#54514A", background: "#EDEAE3" },
  // Added in D5.3. text-tertiary is the app's most-used meta colour and had
  // never been in this list — it measured 2.56:1 before being darkened. The
  // limestone value keeps the same discipline.
  { label: "text-tertiary on bg-surface", foreground: "#6B675D", background: "#FFFFFF" },
  { label: "text-tertiary on bg-app", foreground: "#6B675D", background: "#F4F2ED" },
  { label: "text-tertiary on bg-subtle", foreground: "#6B675D", background: "#EDEAE3" },
  { label: "text-on-accent on accent-solid", foreground: "#FFFFFF", background: "#2F5747" },
  { label: "accent-text on accent-subtle", foreground: "#2F5747", background: "#E9F0EA" },
  { label: "accent-text on bg-surface", foreground: "#2F5747", background: "#FFFFFF" },
  // Gilt (N0.2): the ceremonial family's text shade, everywhere it carries
  // words — the seal badge label and the wordmark caption.
  { label: "gilt-text on bg-surface", foreground: "#7A5410", background: "#FFFFFF" },
  { label: "gilt-text on bg-app", foreground: "#7A5410", background: "#F4F2ED" },
  { label: "gilt-text on gilt-subtle", foreground: "#7A5410", background: "#F6EFDD" },
  { label: "status-success-text on its subtle", foreground: "#047857", background: "#ECFDF5" },
  { label: "status-warning-text on its subtle", foreground: "#A84D08", background: "#FFFBEB" },
  { label: "status-danger-text on its subtle", foreground: "#B91C1C", background: "#FEF2F2" },
  { label: "status-info-text on its subtle", foreground: "#1D4ED8", background: "#EFF6FF" },
  { label: "status-neutral-text on its subtle", foreground: "#52525B", background: "#F4F4F5" },
];

/**
 * The PRD's brand values, measured. These are FILLS — dots, bars, borders,
 * chart series, filled badges — and several of them miss 4.5:1 when used as
 * small text, which is exactly why the `-text` tokens exist. Recorded here so
 * the gap is visible in the gallery instead of being quietly assumed away.
 * The 3:1 floor is the WCAG minimum for non-text UI, and IS enforced.
 */
export const BRAND_FILL_PAIRS: Array<ContrastPair & { note: string }> = [
  {
    label: "white on accent",
    foreground: "#FFFFFF",
    background: "#35604F",
    note: "7.15:1 — the laurel base clears AA outright (the old indigo missed at 4.47:1). The solid/text split is retained as an architectural seam, not a contrast rescue.",
  },
  {
    label: "accent on accent-subtle",
    foreground: "#35604F",
    background: "#E9F0EA",
    note: "Clears AA at 6.17:1, but the -text shade keeps the set consistent: fills and borders here, accent-text for words.",
  },
  {
    label: "gilt on its subtle",
    foreground: "#A5761F",
    background: "#F6EFDD",
    note: "3.51:1 — the seal badge's border and rule, held to 1.4.11's 3:1. Never text; gilt-text carries the label.",
  },
  {
    label: "status-success on its subtle",
    foreground: "#059669",
    background: "#ECFDF5",
    note: "Dot and border; status-success-text carries the label.",
  },
  {
    label: "status-warning on its subtle",
    foreground: "#C46A08",
    background: "#FFFBEB",
    note: "3.74:1 as a fill after the N0.1 limestone surfaces forced a second darkening (D5.3's #CE7008 fell to 2.94:1 on the new bg-subtle). Still never used as text — status-warning-text carries the words.",
  },
  {
    label: "status-danger on its subtle",
    foreground: "#DC2626",
    background: "#FEF2F2",
    note: "Dot and border; status-danger-text carries the label.",
  },
  {
    label: "status-info on its subtle",
    foreground: "#2563EB",
    background: "#EFF6FF",
    note: "Clears AA at 4.75:1, but the -text shade keeps the set consistent.",
  },
  {
    label: "status-neutral on its subtle",
    foreground: "#71717A",
    background: "#F4F4F5",
    note: "4.40:1 — under AA for text; status-neutral-text is used for labels.",
  },
];
