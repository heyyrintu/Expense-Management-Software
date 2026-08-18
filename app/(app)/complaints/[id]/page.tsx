// Complaint detail (7.3). Visible to the person who raised it and to
// finance_admin+ — canViewComplaint decides, and a complaint from another org
// simply does not resolve (scopedDb + RLS).
import Link from "next/link";
import { notFound } from "next/navigation";

import { ComplaintStatusBadge, SlaBadge } from "@/components/sla-badge";
import { requireSession } from "@/lib/auth/guard";
import { disputedApproverIds, financePool } from "@/lib/complaints/queries";
import { scopedDb } from "@/lib/db/scoped";
import {
  availableActions,
  canManageComplaint,
  canViewComplaint,
  eligibleAssignees,
  COMPLAINT_TYPE_LABELS,
  type ComplaintStatus,
  type ComplaintType,
} from "@/lib/domain/complaint";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { signedComplaintUrl } from "@/lib/storage/complaints";
import { signedProofUrl } from "@/lib/storage/payment-proofs";
import { HandlerPanel } from "./handler-panel";
import { ComplaintThread, type ThreadMessage } from "./thread";

type LoadedComplaint = {
  id: string;
  type: ComplaintType;
  status: ComplaintStatus;
  description: string;
  attachmentKey: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  raisedById: string;
  assignedToId: string | null;
  reportId: string | null;
  reimbursementId: string | null;
  raisedBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
  report: { id: string; title: string; status: string; total: number } | null;
  reimbursement: {
    id: string;
    reference: string;
    amountPaid: number;
    paidAt: Date;
    method: string;
    proofKey: string | null;
    reportId: string;
  } | null;
  messages: Array<{
    id: string;
    body: string;
    createdAt: Date;
    authorId: string;
    author: { name: string };
  }>;
};

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  const { id } = await params;

  const complaint = (await db.complaint.findUnique({
    where: { id },
    include: {
      raisedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      report: { select: { id: true, title: true, status: true, total: true } },
      reimbursement: {
        select: {
          id: true,
          reference: true,
          amountPaid: true,
          paidAt: true,
          method: true,
          proofKey: true,
          reportId: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  })) as LoadedComplaint | null;

  if (
    !complaint ||
    !canViewComplaint({
      actorId: ctx.userId,
      actorRole: ctx.role,
      raisedById: complaint.raisedById,
    })
  ) {
    notFound();
  }

  const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
  const isHandler = canManageComplaint(ctx.role);

  // The finance pool minus the complainant and every disputed approver.
  const excluded = isHandler
    ? await disputedApproverIds(db, {
        reportId: complaint.reportId,
        reimbursementId: complaint.reimbursementId,
      })
    : [];
  const assignees = isHandler
    ? eligibleAssignees(await financePool(db), {
        raisedById: complaint.raisedById,
        disputedApproverIds: excluded,
      })
    : [];

  const attachmentUrl = complaint.attachmentKey
    ? await signedComplaintUrl({ attachmentKey: complaint.attachmentKey })
    : null;
  // payment_not_received auto-links the 6.1 payment proof — no copy is made.
  const proofUrl = complaint.reimbursement?.proofKey
    ? await signedProofUrl({ proofKey: complaint.reimbursement.proofKey })
    : null;

  const messages: ThreadMessage[] = complaint.messages.map((m) => ({
    id: m.id,
    authorName: m.author.name,
    body: m.body,
    when: formatDate(m.createdAt),
    mine: m.authorId === ctx.userId,
  }));

  const targetHref = complaint.report
    ? `/reports/${complaint.report.id}`
    : complaint.reimbursement
      ? `/reports/${complaint.reimbursement.reportId}`
      : null;

  return (
    <section className="grid max-w-3xl gap-6">
      <div>
        <Link href="/complaints" className="text-muted-foreground text-sm hover:underline">
          ← All complaints
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">
            {COMPLAINT_TYPE_LABELS[complaint.type]}
          </h1>
          <ComplaintStatusBadge status={complaint.status} />
          <SlaBadge
            createdAt={complaint.createdAt}
            resolvedAt={complaint.resolvedAt}
            status={complaint.status}
          />
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Raised by {complaint.raisedBy.name} on {formatDate(complaint.createdAt)} ·{" "}
          {complaint.assignedTo
            ? `handled by ${complaint.assignedTo.name}`
            : "not yet assigned"}
        </p>
      </div>

      <div className="grid gap-2 rounded-lg border p-4">
        <p className="text-sm whitespace-pre-wrap">{complaint.description}</p>
        <div className="text-muted-foreground flex flex-wrap gap-3 text-sm">
          {targetHref ? (
            <Link href={targetHref} className="underline">
              {complaint.report
                ? `Report “${complaint.report.title}”`
                : `Payment ${complaint.reimbursement?.reference}`}
            </Link>
          ) : null}
          {complaint.reimbursement ? (
            <span>
              {formatMoney(complaint.reimbursement.amountPaid, org.currency)} via{" "}
              {complaint.reimbursement.method.replace("_", " ")} on{" "}
              {formatDate(complaint.reimbursement.paidAt)}
            </span>
          ) : null}
          {attachmentUrl ? (
            <a href={attachmentUrl} target="_blank" rel="noreferrer" className="underline">
              Attachment
            </a>
          ) : null}
          {proofUrl ? (
            <a href={proofUrl} target="_blank" rel="noreferrer" className="underline">
              Payment proof (auto-attached)
            </a>
          ) : null}
        </div>
      </div>

      {complaint.resolutionNote ? (
        <div className="grid gap-1 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-medium">
            {complaint.status === "resolved" ? "Resolved" : "Closed as won't fix"}
            {complaint.resolvedAt ? ` on ${formatDate(complaint.resolvedAt)}` : ""}
          </p>
          <p className="whitespace-pre-wrap">{complaint.resolutionNote}</p>
        </div>
      ) : null}

      {isHandler ? (
        <HandlerPanel
          complaintId={complaint.id}
          assignedToId={complaint.assignedToId}
          assignees={assignees.map((a) => ({ id: a.id, name: a.name, role: a.role }))}
          actions={availableActions(complaint.status)}
          excludedCount={excluded.length}
        />
      ) : null}

      <ComplaintThread complaintId={complaint.id} messages={messages} />
    </section>
  );
}
