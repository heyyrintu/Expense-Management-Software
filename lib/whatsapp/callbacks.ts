// Button callbacks for WhatsApp capture (8.2): Confirm · Edit · Discard.
//
// Idempotency has two layers:
//   * the same webhook delivered twice is stopped by the unique waMessageId
//     on WhatsAppInbound (handled in the route)
//   * the same user tapping twice arrives as DIFFERENT messages, so each
//     action is written to be safe to repeat — discard nulls the link, and a
//     second tap simply reports that it was already handled
import type { ScopedDb } from "@/lib/db/scoped";
import type { SessionCtx } from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { deleteReceiptObject } from "@/lib/storage/receipts";
import {
  ALREADY_HANDLED_REPLY,
  CONFIRM_REPLY,
  DISCARD_REPLY,
  GONE_REPLY,
  editReply,
  type CaptureAction,
} from "./capture";

type InboundRow = {
  id: string;
  userId: string | null;
  expenseId: string | null;
  status: string;
};

export type CallbackResult = { reply: string };

function auditCtx(orgId: string, userId: string): SessionCtx {
  return { userId, orgId, orgSlug: "", role: "employee" };
}

export function expenseUrl(expenseId: string): string {
  const base = (process.env.AUTH_URL ?? "").replace(/\/$/, "");
  return `${base}/expenses/${expenseId}`;
}

/**
 * Act on a Confirm/Edit/Discard tap. `senderUserId` is the person who tapped,
 * resolved from their verified link — a payload naming someone else's message
 * is refused even inside the same org.
 */
export async function handleCaptureCallback(
  db: ScopedDb,
  orgId: string,
  senderUserId: string,
  action: CaptureAction,
  inboundId: string
): Promise<CallbackResult> {
  const inbound = (await db.whatsAppInbound.findUnique({
    where: { id: inboundId },
    select: { id: true, userId: true, expenseId: true, status: true },
  })) as InboundRow | null;

  // Not ours, or not this person's — same answer either way, no probing.
  if (!inbound || inbound.userId !== senderUserId) {
    return { reply: GONE_REPLY };
  }
  if (!inbound.expenseId) {
    return { reply: ALREADY_HANDLED_REPLY };
  }

  const expense = (await db.expense.findUnique({
    where: { id: inbound.expenseId },
    select: { id: true, status: true, reportId: true },
  })) as { id: string; status: string; reportId: string | null } | null;
  if (!expense) {
    await db.whatsAppInbound.update({
      where: { id: inbound.id },
      data: { expenseId: null },
    });
    return { reply: GONE_REPLY };
  }

  switch (action) {
    case "edit":
      return { reply: editReply(expenseUrl(expense.id)) };

    case "confirm": {
      // Nothing to change — the draft already exists. Just close the loop and
      // record the acknowledgement.
      await db.whatsAppInbound.update({
        where: { id: inbound.id },
        data: { status: "processed", processedAt: new Date() },
      });
      await logAudit(db, auditCtx(orgId, senderUserId), {
        entity: "Expense",
        entityId: expense.id,
        action: "expense.whatsapp_confirmed",
        meta: { channel: "whatsapp", inboundId: inbound.id },
      });
      return { reply: CONFIRM_REPLY };
    }

    case "discard": {
      // Only ever a Draft that WhatsApp itself created; anything attached to
      // a report is off-limits (CLAUDE.md: no hard delete past Draft).
      if (expense.status !== "draft" || expense.reportId) {
        return {
          reply:
            "That expense is already on a report, so I've left it alone. You can remove it in the app.",
        };
      }

      const receipts = (await db.receipt.findMany({
        where: { expenseId: expense.id },
        select: { id: true, storageKey: true },
      })) as Array<{ id: string; storageKey: string }>;

      // Unlink first: if object deletion fails we must not orphan the draft.
      await db.whatsAppInbound.update({
        where: { id: inbound.id },
        data: { expenseId: null, status: "ignored", processedAt: new Date() },
      });
      await db.receipt.deleteMany({ where: { expenseId: expense.id } });
      await db.expense.delete({ where: { id: expense.id } });
      for (const receipt of receipts) {
        try {
          await deleteReceiptObject(receipt.storageKey);
        } catch (e) {
          console.error("[whatsapp] receipt object delete failed:", e);
        }
      }

      await logAudit(db, auditCtx(orgId, senderUserId), {
        entity: "Expense",
        entityId: expense.id,
        action: "expense.whatsapp_discarded",
        meta: {
          channel: "whatsapp",
          inboundId: inbound.id,
          receiptsDeleted: receipts.length,
        },
      });
      return { reply: DISCARD_REPLY };
    }
  }
}
