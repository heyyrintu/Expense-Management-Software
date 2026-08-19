// WhatsApp capture domain (8.2) — pure. Turns a chat message into the fields
// of a draft expense, encodes/decodes the button payloads, and owns every
// line of copy the bot sends back.
//
// Money is parsed straight to integer minor units; no float ever touches an
// amount (CLAUDE.md).
import { formatMoney } from "@/lib/money";

// ---------------------------------------------------------------------------
// Text messages: "lunch 450", "₹1,250.50 client dinner", "Uber Rs 340"
// ---------------------------------------------------------------------------

export type ParsedTextExpense = {
  /** integer minor units */
  amount: number;
  /** the message minus the amount — becomes the purpose/merchant hint */
  description: string;
};

export type TextParseResult =
  | { ok: true; expense: ParsedTextExpense }
  | { ok: false; reason: "empty" | "no_amount" | "ambiguous" | "too_large" };

/** Amounts we accept: 450 · 450.75 · 1,250 · 1,250.50 (max 2 decimals). */
const AMOUNT_TOKEN = /(?:^|[\s(])(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?(?=$|[\s).,:;!?-])/gi;
/** Anything that looks like a currency-tagged number, for the ambiguity check. */
const MAX_MINOR_UNITS = 100_000_000_00; // ₹100 crore — beyond this it's a typo

type Candidate = { minor: number; start: number; end: number; tagged: boolean };

function candidates(input: string): Candidate[] {
  const found: Candidate[] = [];
  AMOUNT_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AMOUNT_TOKEN.exec(input)) !== null) {
    const whole = Number.parseInt(m[1].replace(/,/g, ""), 10);
    const frac = m[2] ? Number.parseInt(m[2].padEnd(2, "0"), 10) : 0;
    if (!Number.isFinite(whole)) continue;
    const matched = m[0];
    const leading = matched.length - matched.trimStart().length;
    const start = m.index + leading;
    found.push({
      minor: whole * 100 + frac,
      start,
      end: m.index + matched.length,
      tagged: /₹|rs|inr/i.test(matched),
    });
    // A zero-width step is impossible here, but guard anyway.
    if (AMOUNT_TOKEN.lastIndex === m.index) AMOUNT_TOKEN.lastIndex++;
  }
  return found;
}

/**
 * Pick the amount from a free-text message. A currency-tagged number always
 * wins; otherwise the message must contain exactly one bare number, so
 * "table 4 lunch 450" is refused rather than guessed at.
 */
export function parseTextExpense(raw: string): TextParseResult {
  const input = (raw ?? "").trim();
  if (input.length === 0) return { ok: false, reason: "empty" };

  const all = candidates(input);
  if (all.length === 0) return { ok: false, reason: "no_amount" };

  const tagged = all.filter((c) => c.tagged);
  let chosen: Candidate;
  if (tagged.length === 1) {
    chosen = tagged[0];
  } else if (tagged.length > 1) {
    return { ok: false, reason: "ambiguous" };
  } else if (all.length === 1) {
    chosen = all[0];
  } else {
    return { ok: false, reason: "ambiguous" };
  }

  if (chosen.minor <= 0) return { ok: false, reason: "no_amount" };
  if (chosen.minor > MAX_MINOR_UNITS) return { ok: false, reason: "too_large" };

  const description = `${input.slice(0, chosen.start)} ${input.slice(chosen.end)}`
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:;,.()]+|[\s\-–—:;,.()]+$/g, "")
    .trim();

  return { ok: true, expense: { amount: chosen.minor, description } };
}

/** Merchant guess from the leftover words — title-ish, never empty. */
export function merchantFromDescription(
  description: string,
  fallback = "WhatsApp expense"
): string {
  const cleaned = description.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return fallback;
  return cleaned.slice(0, 60);
}

// ---------------------------------------------------------------------------
// Button payloads: "wa:<action>:<inboundId>"
// ---------------------------------------------------------------------------

export const CAPTURE_ACTIONS = ["confirm", "edit", "discard"] as const;
export type CaptureAction = (typeof CAPTURE_ACTIONS)[number];

export function encodeButtonPayload(action: CaptureAction, inboundId: string): string {
  return `wa:${action}:${inboundId}`;
}

export function decodeButtonPayload(
  payload: string | null | undefined
): { action: CaptureAction; inboundId: string } | null {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "wa") return null;
  const [, action, inboundId] = parts;
  if (!(CAPTURE_ACTIONS as readonly string[]).includes(action)) return null;
  if (!inboundId) return null;
  return { action: action as CaptureAction, inboundId };
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

export const MEDIA_TOO_LARGE_REPLY =
  "That file is a bit too big for me (10 MB max). Try a photo instead of a scan, or add it in the app.";

export const UNSUPPORTED_MEDIA_REPLY =
  "I can read JPG, PNG and PDF receipts. Send one of those and I'll turn it into a draft expense.";

export const HELP_REPLY = [
  "I didn't catch an amount in that. Here's what I can do:",
  "",
  "📷 Send a photo or PDF of a receipt — I'll read it and create a draft expense.",
  "✍️ Send a quick note with an amount, like “lunch 450” or “₹1,250 client dinner”.",
  "",
  "Everything lands as a draft, so you can fix anything in the app before submitting.",
].join("\n");

export const DUPLICATE_REPLY =
  "I've already handled that one — check your drafts in the app.";

export type SummaryInput = {
  merchant: string;
  amount: number;
  currency: string;
  date: Date;
  ocrUsed: boolean;
  amountConfident: boolean;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatChatDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Merchant X, ₹450.00, 12 Aug — correct?" */
export function captureSummary(input: SummaryInput): string {
  const money = formatMoney(input.amount, input.currency);
  const head = `${input.merchant}, ${money}, ${formatChatDate(input.date)} — correct?`;
  if (!input.amountConfident) {
    return [
      input.ocrUsed
        ? "I saved your receipt but couldn't read the amount."
        : "I saved your receipt.",
      `${input.merchant}, ${formatChatDate(input.date)} — open it in the app to fill in the amount.`,
    ].join(" ");
  }
  return head;
}

export const CONFIRM_REPLY = "Saved as a draft. Add it to a report in the app when you're ready.";
export const DISCARD_REPLY = "Deleted — nothing was kept.";
export const ALREADY_HANDLED_REPLY = "That one's already been dealt with.";
export const GONE_REPLY = "I can't find that expense any more — it may already be deleted.";

export function editReply(url: string): string {
  return `Open it here to edit: ${url}`;
}

/** Buttons in a fixed order so payload indexes stay stable. */
export function captureButtons(inboundId: string): Array<{ id: string; title: string }> {
  return [
    { id: encodeButtonPayload("confirm", inboundId), title: "✅ Looks right" },
    { id: encodeButtonPayload("edit", inboundId), title: "✏️ Edit" },
    { id: encodeButtonPayload("discard", inboundId), title: "🗑 Discard" },
  ];
}
