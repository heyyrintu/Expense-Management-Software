import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { asFlags, FlagChips } from "@/components/flag-chips";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/guard";
import { isExpenseEditable, type ExpenseStatus } from "@/lib/domain/expense";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate, toDateInputValue } from "@/lib/format";
import { formatMoney, toDecimalString } from "@/lib/money";
import { signedReceiptUrl } from "@/lib/storage/receipts";
import type { Option } from "../expense-form";
import { EditExpenseWrapper } from "./edit-wrapper";
import { EditMileageWrapper } from "./edit-mileage-wrapper";
import { ReceiptUploader } from "./receipt-uploader";
import type { ReceiptView } from "./receipt-types";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const db = scopedDb(ctx.orgId);
  // own expenses only — someone else's id (or another org's) is a 404
  const expense = await db.expense.findUnique({
    where: { id, userId: ctx.userId },
    include: {
      category: { select: { id: true, name: true } },
      splits: {
        select: { categoryId: true, projectId: true, amount: true },
      },
      receipts: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          storageKey: true,
          ocrData: true,
        },
      },
    },
  });
  if (!expense) notFound();

  // most recent receipt with extracted values drives the review panel
  type OcrData = { merchant?: string; date?: string; amount?: number } | null;
  const latestOcr = [...expense.receipts]
    .reverse()
    .map((r: { ocrData: unknown }) => r.ocrData as OcrData)
    .find((o: OcrData) => o && (o.merchant || o.date || o.amount));
  const ocrSuggestion = latestOcr
    ? {
        merchant: latestOcr.merchant,
        date: latestOcr.date,
        amount:
          latestOcr.amount !== undefined
            ? toDecimalString(latestOcr.amount)
            : undefined,
      }
    : undefined;

  // signed URLs only for receipts fetched through the org-scoped query above
  const receiptViews: ReceiptView[] = await Promise.all(
    expense.receipts.map(
      async (r: { id: string; fileName: string; mimeType: string; storageKey: string }) => ({
        id: r.id,
        fileName: r.fileName,
        mimeType: r.mimeType,
        url: await signedReceiptUrl(r),
      })
    )
  );

  if (isExpenseEditable(expense.status as ExpenseStatus)) {
    const [categories, projects, clients] = await Promise.all([
      db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    ]);
    if (expense.type === "mileage") {
      const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.orgId } });
      return (
        <section className="grid gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Edit mileage expense</h1>
            <StatusBadge status={expense.status} />
          </div>
          <EditMileageWrapper
            expenseId={expense.id}
            defaults={{
              distanceKm: String(expense.distanceKm ?? ""),
              date: toDateInputValue(expense.date),
              categoryId: expense.categoryId,
              projectId: expense.projectId ?? "",
              purpose: expense.purpose,
            }}
            categories={categories as Option[]}
            projects={projects as Option[]}
            currency={expense.currency}
            ratePerKmMinor={org.mileageRate}
          />
          <div className="max-w-md border-t pt-4">
            <ReceiptUploader
              expenseId={expense.id}
              receipts={receiptViews}
              readOnly={false}
            />
          </div>
        </section>
      );
    }
    return (
      <section className="grid gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Edit expense</h1>
          <StatusBadge status={expense.status} />
        </div>
        <EditExpenseWrapper
          expenseId={expense.id}
          defaults={{
            amount: toDecimalString(expense.amount),
            currency: expense.currency,
            fxRate: expense.fxRate,
            date: toDateInputValue(expense.date),
            merchant: expense.merchant,
            categoryId: expense.categoryId,
            projectId: expense.projectId ?? "",
            purpose: expense.purpose,
            billable: expense.billable,
            clientId: expense.clientId ?? "",
            taxAmount:
              expense.taxAmount !== null ? toDecimalString(expense.taxAmount) : "",
            taxNumber: expense.taxNumber ?? "",
            splits: expense.splits.map(
              (sp: { categoryId: string; projectId: string | null; amount: number }) => ({
                categoryId: sp.categoryId,
                projectId: sp.projectId ?? "",
                value: toDecimalString(sp.amount),
              })
            ),
          }}
          categories={categories as Option[]}
          projects={projects as Option[]}
          clients={clients as { id: string; name: string; code: string }[]}
          currency={expense.currency}
          ocr={ocrSuggestion}
          receiptCount={receiptViews.length}
        />
        <div className="max-w-md border-t pt-4">
          <ReceiptUploader
            expenseId={expense.id}
            receipts={receiptViews}
            readOnly={false}
          />
        </div>
      </section>
    );
  }

  // read-only detail for non-draft expenses
  return (
    <section className="grid max-w-md gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{expense.merchant}</h1>
        <StatusBadge status={expense.status} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{formatMoney(expense.amount, expense.currency)}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground grid gap-1 text-sm">
          <FlagChips flags={asFlags(expense.flags)} />
          <p>Date: {formatDate(expense.date)}</p>
          <p>Category: {expense.category.name}</p>
          {expense.purpose ? <p>Purpose: {expense.purpose}</p> : null}
          <p className="pt-2">
            This expense is {expense.status} and can no longer be edited.
          </p>
        </CardContent>
      </Card>
      <ReceiptUploader
        expenseId={expense.id}
        receipts={receiptViews}
        readOnly
      />
    </section>
  );
}
