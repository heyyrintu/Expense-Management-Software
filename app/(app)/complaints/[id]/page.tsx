// Complaint detail (7.3). Visible to the person who raised it and to
// finance_admin+ — canViewComplaint decides, and a complaint from another org
// simply does not resolve (scopedDb + RLS).
import { notFound } from "next/navigation";

import {
  ComplaintHeaderCard,
  ResolutionCard,
  type ComplaintHeaderProps,
} from "@/components/complaints/complaint-header-card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/guard";
import { disputedApproverIds, financePool } from "@/lib/complaints/queries";
import { scopedDb } from "@/lib/db/scoped";
import {
  availableActions,
  canManageComplaint,
  canViewComplaint,
  eligibleAssignees,
  isClosed as isComplaintClosed,
  COMPLAINT_TYPE_LABELS,
  type ComplaintStatus,
  type ComplaintType,
} from "@/lib/domain/complaint";
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
    when: m.createdAt.toISOString(),
    mine: m.authorId === ctx.userId,
  }));

  // The header card renders amounts and dates itself, so it gets structured
  // values rather than a pre-formatted sentence (D1.1).
  const target: ComplaintHeaderProps["target"] = complaint.report
    ? {
        kind: "report",
        href: `/reports/${complaint.report.id}`,
        title: complaint.report.title,
      }
    : complaint.reimbursement
      ? {
          kind: "payment",
          href: `/reports/${complaint.reimbursement.reportId}`,
          reference: complaint.reimbursement.reference,
          amount: complaint.reimbursement.amountPaid,
          currency: org.currency,
          paidAt: complaint.reimbursement.paidAt.toISOString(),
          method: complaint.reimbursement.method,
        }
      : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Complaints", href: "/complaints" },
          { label: COMPLAINT_TYPE_LABELS[complaint.type] },
        ]}
        title={COMPLAINT_TYPE_LABELS[complaint.type]}
        description="Everything about this dispute, and the conversation it started."
      />

      {/* Two columns on desktop: the dispute and its conversation on the
          left, the handler's controls beside them. One column below lg —
          and the controls come LAST there, because a handler on a phone
          still has to read the complaint before acting on it. */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid content-start gap-4 lg:col-span-8">
          <ComplaintHeaderCard
            type={complaint.type}
            status={complaint.status}
            description={complaint.description}
            createdAt={complaint.createdAt.toISOString()}
            resolvedAt={complaint.resolvedAt?.toISOString() ?? null}
            raisedByName={complaint.raisedBy.name}
            assignedToName={complaint.assignedTo?.name ?? null}
            target={target}
            attachmentUrl={attachmentUrl}
            proofUrl={proofUrl}
          />

          {complaint.resolutionNote ? (
            <ResolutionCard
              status={complaint.status}
              note={complaint.resolutionNote}
              resolvedAt={complaint.resolvedAt?.toISOString() ?? null}
            />
          ) : null}

          <ComplaintThread
            complaintId={complaint.id}
            messages={messages}
            closed={isComplaintClosed(complaint.status)}
          />
        </div>

        {isHandler ? (
          <div className="lg:col-span-4">
            <HandlerPanel
              complaintId={complaint.id}
              assignedToId={complaint.assignedToId}
              assignees={assignees.map((a) => ({ id: a.id, name: a.name, role: a.role }))}
              actions={availableActions(complaint.status)}
              excludedCount={excluded.length}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
