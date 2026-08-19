// WhatsApp → draft expense pipeline (8.2).
//
// Two entry points, both org-scoped by the caller (the webhook resolved the
// org from the BUSINESS number before anything here runs):
//   captureMediaMessage — photo/PDF receipt: download → org receipt storage →
//     OCR → draft expense
//   captureTextMessage  — "lunch 450": parse → draft expense, text as purpose
//
// Everything lands as a DRAFT, flagged for review, so nothing bypasses the
// normal report/approval path. Failures reply in plain language and never
// throw into the webhook.
import type { ScopedDb } from "@/lib/db/scoped";
import type { SessionCtx } from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { computeExpenseFlags } from "@/lib/domain/policy-eval";
import { extractReceipt } from "@/lib/ocr";
import { validateReceiptFile } from "@/lib/schemas/receipt";
import { buildReceiptKey, putReceiptObject } from "@/lib/storage/receipts";
import {
  captureSummary,
  merchantFromDescription,
  parseTextExpense,
  HELP_REPLY,
  MEDIA_TOO_LARGE_REPLY,
  UNSUPPORTED_MEDIA_REPLY,
} from "./capture";
import type { InboundMessage, WhatsAppProvider } from "./types";

/** Marks every WhatsApp-created draft, mirroring the email-ingest flag. */
export const WHATSAPP_FLAG = {
  rule: "whatsapp_ingested",
  message:
    "Created from WhatsApp — check the amount and category before submitting.",
};
/** Same convention as 6.6: unreadable amount becomes 1 minor unit, flagged. */
const PLACEHOLDER_AMOUNT = 1;
const FALLBACK_CATEGORY = "WhatsApp receipts";

export type CaptureOutcome = {
  /** What to send back to the user. */
  reply: string;
  /** Present when a draft was created — the webhook attaches buttons. */
  expenseId?: string;
  /** Terminal state to record on the WhatsAppInbound row. */
  status: "processed" | "ignored" | "failed";
  error?: string;
};

type CaptureContext = {
  db: ScopedDb;
  orgId: string;
  orgCurrency: string;
  userId: string;
  message: InboundMessage;
};

function auditCtx(orgId: string, userId: string): SessionCtx {
  // WhatsApp acts as the user themselves; role is irrelevant to logAudit and
  // every write here is a draft the user could have made in the app.
  return { userId, orgId, orgSlug: "", role: "employee" };
}

function todayUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/** One shared fallback category per org, created on first use. */
async function fallbackCategoryId(db: ScopedDb, orgId: string): Promise<string> {
  const existing = (await db.category.findFirst({
    where: { name: FALLBACK_CATEGORY },
    select: { id: true },
  })) as { id: string } | null;
  if (existing) return existing.id;
  const created = (await db.category.create({
    data: { orgId, name: FALLBACK_CATEGORY },
    select: { id: true },
  })) as { id: string };
  return created.id;
}

async function createDraft(
  ctx: CaptureContext,
  input: {
    amount: number;
    date: Date;
    merchant: string;
    purpose: string;
    receiptCount: number;
  }
): Promise<string> {
  const categoryId = await fallbackCategoryId(ctx.db, ctx.orgId);
  const policyFlags = await computeExpenseFlags(ctx.db, ctx.orgId, {
    expenseId: null,
    userId: ctx.userId,
    amount: input.amount,
    baseAmount: input.amount,
    date: input.date,
    merchant: input.merchant,
    categoryId,
    receiptCount: input.receiptCount,
  });
  const expense = (await ctx.db.expense.create({
    data: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      amount: input.amount,
      baseAmount: input.amount,
      fxRate: "1",
      currency: ctx.orgCurrency,
      date: input.date,
      merchant: input.merchant,
      categoryId,
      purpose: input.purpose,
      flags: [WHATSAPP_FLAG, ...policyFlags],
    },
    select: { id: true },
  })) as { id: string };
  return expense.id;
}

/** Photo or PDF receipt → stored receipt + OCR-prefilled draft. */
export async function captureMediaMessage(
  ctx: CaptureContext,
  provider: WhatsAppProvider
): Promise<CaptureOutcome> {
  const mediaId = ctx.message.mediaId;
  if (!mediaId) return { reply: UNSUPPORTED_MEDIA_REPLY, status: "ignored" };

  const download = await provider.downloadMedia(mediaId);
  if (!download.ok) {
    return {
      reply: "I couldn't fetch that file from WhatsApp. Please try sending it again.",
      status: "failed",
      error: download.error,
    };
  }

  // Same 10 MB / JPG-PNG-PDF rule as every other upload path.
  const invalid = validateReceiptFile({
    name: download.fileName,
    type: download.contentType,
    size: download.body.length,
  });
  if (invalid) {
    return {
      reply: /10 MB/.test(invalid) ? MEDIA_TOO_LARGE_REPLY : UNSUPPORTED_MEDIA_REPLY,
      status: "ignored",
    };
  }

  const ocr = await extractReceipt({
    buffer: download.body,
    mimeType: download.contentType,
  });
  const amountConfident = typeof ocr.amount === "number" && ocr.amount > 0;
  const amount = amountConfident ? (ocr.amount as number) : PLACEHOLDER_AMOUNT;
  const date = ocr.date ? new Date(`${ocr.date}T00:00:00.000Z`) : todayUtc();
  const merchant = ocr.merchant ?? merchantFromDescription(ctx.message.text ?? "", "WhatsApp receipt");

  const expenseId = await createDraft(ctx, {
    amount,
    date,
    merchant,
    purpose: ctx.message.text?.trim() || "Receipt sent on WhatsApp",
    receiptCount: 1,
  });

  const key = buildReceiptKey(ctx.orgId, expenseId, download.fileName);
  await putReceiptObject({
    key,
    body: download.body,
    contentType: download.contentType,
    fileName: download.fileName,
  });
  await ctx.db.receipt.create({
    data: {
      orgId: ctx.orgId,
      expenseId,
      storageKey: key,
      fileName: download.fileName,
      mimeType: download.contentType,
      sizeBytes: download.body.length,
      ocrData: Object.keys(ocr).length > 0 ? ocr : undefined,
    },
  });

  await logAudit(ctx.db, auditCtx(ctx.orgId, ctx.userId), {
    entity: "Expense",
    entityId: expenseId,
    action: "expense.whatsapp_ingested",
    meta: {
      channel: "whatsapp",
      waMessageId: ctx.message.waMessageId,
      kind: "media",
      ocrRead: amountConfident,
    },
  });

  return {
    reply: captureSummary({
      merchant,
      amount,
      currency: ctx.orgCurrency,
      date,
      ocrUsed: true,
      amountConfident,
    }),
    expenseId,
    status: "processed",
  };
}

/** "lunch 450" → draft expense with the message as its purpose. */
export async function captureTextMessage(
  ctx: CaptureContext
): Promise<CaptureOutcome> {
  const text = ctx.message.text ?? "";
  const parsed = parseTextExpense(text);
  if (!parsed.ok) {
    return {
      reply:
        parsed.reason === "ambiguous"
          ? "I found more than one number in there. Try putting the amount alone, like “lunch ₹450”."
          : parsed.reason === "too_large"
            ? "That amount looks too big — add it in the app instead."
            : HELP_REPLY,
      status: "ignored",
    };
  }

  const merchant = merchantFromDescription(parsed.expense.description);
  const date = todayUtc();
  const expenseId = await createDraft(ctx, {
    amount: parsed.expense.amount,
    date,
    merchant,
    purpose: text.trim(),
    receiptCount: 0,
  });

  await logAudit(ctx.db, auditCtx(ctx.orgId, ctx.userId), {
    entity: "Expense",
    entityId: expenseId,
    action: "expense.whatsapp_ingested",
    meta: {
      channel: "whatsapp",
      waMessageId: ctx.message.waMessageId,
      kind: "text",
    },
  });

  return {
    reply: captureSummary({
      merchant,
      amount: parsed.expense.amount,
      currency: ctx.orgCurrency,
      date,
      ocrUsed: false,
      amountConfident: true,
    }),
    expenseId,
    status: "processed",
  };
}

export type { CaptureContext };
