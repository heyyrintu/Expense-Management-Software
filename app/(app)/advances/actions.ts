"use server";

// Cash-advance lifecycle actions (6.2). Transitions only via
// nextAdvanceStatus(); AuditLog on every transition; owner-pinned writes.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireRole,
  requireSession,
} from "@/lib/auth/guard";
import {
  canDecideAdvance,
  nextAdvanceStatus,
  type AdvanceStatus,
} from "@/lib/domain/advance";
import { logAudit } from "@/lib/domain/audit";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { formatMoney, parseToMinorUnits } from "@/lib/money";
import { sendEmail } from "@/lib/notifications/email";
import { moneyString } from "@/lib/schemas/category";
import { z } from "zod";

const requestSchema = z
  .object({
    amount: moneyString,
    purpose: z.string().trim().min(1, "What is the advance for?").max(200),
    tripStart: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
    tripEnd: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  })
  .refine(
    (d) => !d.tripStart || !d.tripEnd || d.tripStart <= d.tripEnd,
    { message: "Trip end must be after the start", path: ["tripEnd"] }
  );

const idSchema = z.object({ id: z.string().uuid() });
const decisionSchema = z
  .object({
    id: z.string().uuid(),
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.action === "approve" || (d.reason && d.reason.length > 0), {
    message: "A reason is required to reject.",
    path: ["reason"],
  });

function guardError(e: unknown): Result | null {
  if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
    return err(e.message);
  }
  return null;
}

async function notifyUser(
  db: ReturnType<typeof scopedDb>,
  orgId: string,
  userId: string,
  email: string,
  type: string,
  title: string,
  body: string,
  link: string
): Promise<void> {
  try {
    await db.notification.create({
      data: { orgId, userId, type, title, body, link },
    });
    await sendEmail({ to: email, subject: title, text: `${body}\n\nOpen: ${link}` });
  } catch (e) {
    console.error("[advances] notify failed:", e);
  }
}

export async function createAdvanceAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("employee");
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? userErrors.validation);
    }
    const amount = parseToMinorUnits(parsed.data.amount);
    if (amount === null || amount === 0) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const advance = await db.advance.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        amount,
        purpose: parsed.data.purpose,
        tripStart: parsed.data.tripStart
          ? new Date(`${parsed.data.tripStart}T00:00:00.000Z`)
          : null,
        tripEnd: parsed.data.tripEnd
          ? new Date(`${parsed.data.tripEnd}T00:00:00.000Z`)
          : null,
      },
    });
    await logAudit(db, ctx, {
      entity: "Advance",
      entityId: advance.id,
      action: "advance.created",
      meta: { amount, purpose: parsed.data.purpose },
    });
    revalidatePath("/advances");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function submitAdvanceAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireSession();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const advance = await db.advance.findUnique({
      where: { id: parsed.data.id, userId: ctx.userId },
    });
    if (!advance) return err("Advance not found.");
    const to = nextAdvanceStatus(advance.status as AdvanceStatus, "submit");
    if (!to) return err("Only draft advances can be submitted.");

    await db.advance.update({ where: { id: advance.id }, data: { status: to } });
    await logAudit(db, ctx, {
      entity: "Advance",
      entityId: advance.id,
      action: "advance.submitted",
      meta: { amount: advance.amount },
    });

    const me = await db.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { name: true, approver: { select: { id: true, email: true } } },
    });
    if (me.approver) {
      const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
      await notifyUser(
        db,
        ctx.orgId,
        me.approver.id,
        me.approver.email,
        "advance.submitted",
        "Advance awaiting your approval",
        `${me.name} requested ${formatMoney(advance.amount, org.currency)} — ${advance.purpose}.`,
        "/approvals"
      );
    }
    revalidatePath("/advances");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function deleteAdvanceDraftAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireSession();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const res = await db.advance.deleteMany({
      where: { id: parsed.data.id, userId: ctx.userId, status: "draft" },
    });
    if (res.count === 0) return err("Only your own draft advances can be deleted.");
    await logAudit(db, ctx, {
      entity: "Advance",
      entityId: parsed.data.id,
      action: "advance.deleted",
    });
    revalidatePath("/advances");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}

export async function decideAdvanceAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireRole("approver");
    const parsed = decisionSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? userErrors.validation);
    }

    const db = scopedDb(ctx.orgId);
    const advance = await db.advance.findUnique({
      where: { id: parsed.data.id },
      include: {
        user: { select: { id: true, email: true, approverId: true } },
      },
    });
    if (!advance || advance.status !== "submitted") {
      return err("This advance isn't awaiting a decision.");
    }
    if (
      !canDecideAdvance({
        actorId: ctx.userId,
        ownerId: advance.userId,
        ownerApproverId: advance.user.approverId,
      })
    ) {
      return err("This advance isn't awaiting your decision.");
    }

    const to = nextAdvanceStatus(advance.status as AdvanceStatus, parsed.data.action);
    if (!to) return err("Invalid decision.");

    await db.advance.update({
      where: { id: advance.id },
      data: { status: to, approvedById: ctx.userId },
    });
    await logAudit(db, ctx, {
      entity: "Advance",
      entityId: advance.id,
      action: `advance.${parsed.data.action === "approve" ? "approved" : "rejected"}`,
      meta: { amount: advance.amount, reason: parsed.data.reason ?? null },
    });

    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
    await notifyUser(
      db,
      ctx.orgId,
      advance.user.id,
      advance.user.email,
      `advance.${to}`,
      parsed.data.action === "approve" ? "Advance approved" : "Advance rejected",
      parsed.data.action === "approve"
        ? `Your advance of ${formatMoney(advance.amount, org.currency)} was approved — finance will disburse it.`
        : `Your advance was rejected${parsed.data.reason ? `: ${parsed.data.reason}` : "."}`,
      "/advances"
    );
    revalidatePath("/advances");
    revalidatePath("/approvals");
    return ok(undefined);
  } catch (e) {
    const g = guardError(e);
    if (g) return g;
    throw e;
  }
}
