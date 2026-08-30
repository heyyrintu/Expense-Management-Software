// Pending-approvals email digest job (PLAN 5.6).
// Trigger daily via cron:  curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//   https://<host>/api/jobs/approval-digest
//
// Platform-level iteration touches org IDS only (raw client); everything
// inside an org goes through scopedDb, reusing the exact chain-aware queue
// logic approvers see in the app — the digest can never disagree with the UI.
import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/auth/bearer";
import type { Role } from "@/lib/auth/roles";
import { approvalQueueFor } from "@/lib/domain/approval-queue";
import { buildApprovalDigest } from "@/lib/domain/digest";
import { prisma } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { sendEmail } from "@/lib/notifications/email";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const orgs = (await prisma.organization.findMany({
    where: { status: "active" },
    select: { id: true, currency: true },
  })) as Array<{ id: string; currency: string }>;

  let emailsSent = 0;
  let approversChecked = 0;

  for (const org of orgs) {
    const db = scopedDb(org.id);
    const approvers = (await db.user.findMany({
      where: {
        status: "active",
        role: { in: ["approver", "finance_admin", "org_admin"] },
      },
      select: { id: true, email: true, role: true },
    })) as Array<{ id: string; email: string; role: Role }>;

    for (const approver of approvers) {
      approversChecked += 1;
      const queue = await approvalQueueFor(db, {
        userId: approver.id,
        orgId: org.id,
        role: approver.role,
      });
      if (queue.length === 0) continue;

      const digest = buildApprovalDigest(
        queue.map((q) => ({
          title: q.title,
          ownerName: q.ownerName,
          total: q.total,
          submittedAt: q.submittedAt,
          level: q.level,
        })),
        org.currency,
        new Date(),
        appUrl
      );
      await sendEmail({
        to: approver.email,
        subject: digest.subject,
        text: digest.text,
      });
      emailsSent += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    data: { orgs: orgs.length, approversChecked, emailsSent },
  });
}
