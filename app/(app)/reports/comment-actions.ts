"use server";

// Report thread (5.3): append-only comments, audit-logged, with a
// notification to the other side of the conversation.
import { revalidatePath } from "next/cache";
import {
  AuthenticationError,
  AuthorizationError,
  requireSession,
} from "@/lib/auth/guard";
import { logAudit } from "@/lib/domain/audit";
import { canCommentOnReport } from "@/lib/domain/comments";
import { scopedDb } from "@/lib/db/scoped";
import { userErrors, type Result, ok, err } from "@/lib/errors";
import { sendEmail } from "@/lib/notifications/email";
import { z } from "zod";

const commentSchema = z.object({
  reportId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first").max(1000),
});

export async function addReportCommentAction(input: unknown): Promise<Result> {
  try {
    const ctx = await requireSession();
    const parsed = commentSchema.safeParse(input);
    if (!parsed.success) return err(userErrors.validation);

    const db = scopedDb(ctx.orgId);
    const report = await db.expenseReport.findUnique({
      where: { id: parsed.data.reportId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            approver: { select: { id: true, email: true } },
          },
        },
      },
    });
    if (!report) return err("Report not found.");
    if (
      !canCommentOnReport({
        actorId: ctx.userId,
        actorRole: ctx.role,
        ownerId: report.userId,
      })
    ) {
      return err(userErrors.notAuthorized);
    }

    const author = await db.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { name: true },
    });
    const comment = await db.reportComment.create({
      data: {
        orgId: ctx.orgId,
        reportId: report.id,
        authorId: ctx.userId,
        body: parsed.data.body,
      },
    });
    await logAudit(db, ctx, {
      entity: "ReportComment",
      entityId: comment.id,
      action: "report.commented",
      meta: { reportId: report.id },
    });

    // notify the other side (owner ↔ approval side); failures never block
    try {
      const isOwner = ctx.userId === report.userId;
      const recipient = isOwner
        ? report.user.approver // may be null
        : { id: report.user.id, email: report.user.email };
      if (recipient && recipient.id !== ctx.userId) {
        const link = isOwner
          ? `/approvals/${report.id}` // approver reads it in their queue view
          : `/reports/${report.id}`;
        const title = `New comment on “${report.title}”`;
        const body = `${author.name}: ${parsed.data.body.slice(0, 200)}`;
        await db.notification.create({
          data: {
            orgId: ctx.orgId,
            userId: recipient.id,
            type: "report.commented",
            title,
            body,
            link,
          },
        });
        await sendEmail({ to: recipient.email, subject: title, text: `${body}\n\nOpen: ${link}` });
      }
    } catch (e) {
      console.error("[comments] notify failed:", e);
    }

    revalidatePath(`/reports/${report.id}`);
    revalidatePath(`/approvals/${report.id}`);
    return ok(undefined);
  } catch (e) {
    if (e instanceof AuthenticationError || e instanceof AuthorizationError) {
      return err(e.message);
    }
    throw e;
  }
}
