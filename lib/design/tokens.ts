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
    description: "The interface itself — surfaces, lines and text.",
    tokens: [
      { name: "bg-app", cssVar: "--bg-app", hex: "#FAFAFA", usage: "Page background" },
      { name: "bg-surface", cssVar: "--bg-surface", hex: "#FFFFFF", usage: "Cards, tables, sheets" },
      { name: "bg-subtle", cssVar: "--bg-subtle", hex: "#F4F4F5", usage: "Hover rows, inset panels, disabled fills" },
      { name: "line", cssVar: "--line", hex: "#E4E4E7", usage: "Default hairline" },
      { name: "line-strong", cssVar: "--line-strong", hex: "#D4D4D8", usage: "Inputs, focused containers" },
      { name: "text-primary", cssVar: "--fg-primary", hex: "#18181B", usage: "Headings, amounts" },
      { name: "text-secondary", cssVar: "--fg-secondary", hex: "#52525B", usage: "Labels, body" },
      { name: "text-tertiary", cssVar: "--fg-tertiary", hex: "#A1A1AA", usage: "Meta, placeholders, timestamps" },
    ],
  },
  {
    title: "Accent",
    description: "One accent, used sparingly, always meaning “act here”.",
    tokens: [
      { name: "accent", cssVar: "--accent-base", hex: "#6366F1", usage: "Primary buttons, links, active nav" },
      { name: "accent-hover", cssVar: "--accent-hover-base", hex: "#4F46E5", usage: "Hover on accent surfaces" },
      { name: "accent-pressed", cssVar: "--accent-pressed-base", hex: "#4338CA", usage: "Active/pressed" },
      { name: "accent-subtle", cssVar: "--accent-subtle-base", hex: "#EEF2FF", usage: "Selected row, nav pill, badge background" },
      { name: "accent-border", cssVar: "--accent-border-base", hex: "#C7D2FE", usage: "Border on accent-subtle surfaces" },
      { name: "focus-ring", cssVar: "--focus-ring-base", hex: "#6366F1", usage: "2px ring, 2px offset — always visible" },
      { name: "accent-solid", cssVar: "--accent-solid-base", hex: "#4F46E5", usage: "Filled buttons carrying white text (AA)" },
      { name: "accent-text", cssVar: "--accent-text-base", hex: "#4F46E5", usage: "Links and accent text (AA on subtle)" },
    ],
  },
  {
    title: "Status",
    description:
      "Semantic only, never decoration. Status is never colour alone — always colour plus a label.",
    tokens: [
      { name: "status-success", cssVar: "--status-success", hex: "#059669", usage: "Approved, reimbursed, matched" },
      { name: "status-success-subtle", cssVar: "--status-success-subtle", hex: "#ECFDF5", usage: "Success badge background" },
      { name: "status-warning", cssVar: "--status-warning", hex: "#D97706", usage: "Policy flags, SLA amber, sent back" },
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
      { name: "status-warning-text", cssVar: "--status-warning-text", hex: "#B45309", usage: "Text on warning-subtle" },
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
};

export const TYPE_SCALE: TypeToken[] = [
  { name: "display", className: "text-display", size: 32, lineHeight: 38, weight: 600, tracking: "-0.02em", role: "Amount hero, ledger balance" },
  { name: "h1", className: "text-h1", size: 24, lineHeight: 32, weight: 600, tracking: "-0.015em", role: "Page title" },
  { name: "h2", className: "text-h2", size: 18, lineHeight: 26, weight: 600, tracking: "-0.01em", role: "Section heading" },
  { name: "h3", className: "text-h3", size: 15, lineHeight: 22, weight: 600, tracking: "0", role: "Card title" },
  { name: "body", className: "text-body", size: 14, lineHeight: 22, weight: 400, tracking: "0", role: "Body copy" },
  { name: "body-strong", className: "text-body-strong", size: 14, lineHeight: 22, weight: 600, tracking: "0", role: "Table amount, emphasis" },
  { name: "label", className: "text-label", size: 13, lineHeight: 18, weight: 500, tracking: "0", role: "Field label, caption" },
  { name: "meta", className: "text-meta", size: 12, lineHeight: 16, weight: 400, tracking: "0.01em", role: "Timestamp, meta" },
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
  { name: "sm", className: "rounded-sm", px: "6px", usage: "Badges, inputs" },
  { name: "md", className: "rounded-md", px: "8px", usage: "Buttons, dropdowns" },
  { name: "lg", className: "rounded-lg", px: "12px", usage: "Cards, sheets" },
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
  textPrimary: "#18181B",
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
  { label: "text-primary on bg-app", foreground: "#18181B", background: "#FAFAFA" },
  { label: "text-primary on bg-surface", foreground: "#18181B", background: "#FFFFFF" },
  { label: "text-secondary on bg-surface", foreground: "#52525B", background: "#FFFFFF" },
  { label: "text-secondary on bg-subtle", foreground: "#52525B", background: "#F4F4F5" },
  { label: "text-on-accent on accent-solid", foreground: "#FFFFFF", background: "#4F46E5" },
  { label: "accent-text on accent-subtle", foreground: "#4F46E5", background: "#EEF2FF" },
  { label: "accent-text on bg-surface", foreground: "#4F46E5", background: "#FFFFFF" },
  { label: "status-success-text on its subtle", foreground: "#047857", background: "#ECFDF5" },
  { label: "status-warning-text on its subtle", foreground: "#B45309", background: "#FFFBEB" },
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
    background: "#6366F1",
    note: "4.47:1 — just under AA for small text; accent-solid is used instead on buttons.",
  },
  {
    label: "accent on accent-subtle",
    foreground: "#6366F1",
    background: "#EEF2FF",
    note: "Fill and border only; accent-text carries the words.",
  },
  {
    label: "status-success on its subtle",
    foreground: "#059669",
    background: "#ECFDF5",
    note: "Dot and border; status-success-text carries the label.",
  },
  {
    label: "status-warning on its subtle",
    foreground: "#D97706",
    background: "#FFFBEB",
    note: "Weakest of the set at 3.07:1 — never use as text.",
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
