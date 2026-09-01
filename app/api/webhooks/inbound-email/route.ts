// Email receipt ingestion webhook (PLAN 6.6) — Mailgun forward route.
// Flow: verify signature → org from recipient slug → sender must be an
// active user IN THAT ORG → each valid attachment becomes a receipt +
// OCR-prefilled draft expense. Unknown senders are rejected silently
// (200, logged to the org's dead-letter list — no information leak).
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/domain/audit";
import { computeExpenseFlags } from "@/lib/domain/policy-eval";
import { prisma } from "@/lib/db/client";
import { scopedDb, type ScopedDb } from "@/lib/db/scoped";
import {
  findOurRecipient,
  normalizeSender,
  subjectToPurpose,
} from "@/lib/inbound-email/address";
import {
  parseMailgunWebhook,
  verifyMailgunSignature,
} from "@/lib/inbound-email/mailgun";
import { extractReceipt } from "@/lib/ocr";
import { formatMoney } from "@/lib/money";
import { sendEmail } from "@/lib/notifications/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateReceiptFile } from "@/lib/schemas/receipt";
import { buildReceiptKey, putReceiptObject } from "@/lib/storage/receipts";

export const runtime = "nodejs";

const EMAIL_FLAG = {
  rule: "email_ingested",
  message:
    "Created from an emailed receipt — review the amount and category before submitting.",
};
const FALLBACK_CATEGORY = "Email receipts";

async function deadLetter(
  db: ScopedDb,
  orgId: string,
  fromEmail: string,
  subject: string,
  reason: string
): Promise<void> {
  try {
    await db.inboundEmailFailure.create({
      data: { orgId, fromEmail, subject: subject.slice(0, 200), reason },
    });
  } catch (e) {
    console.error("[inbound-email] dead-letter write failed:", e);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  const mailDomain = process.env.APP_MAIL_DOMAIN;
  if (!signingKey || !mailDomain) {
    return NextResponse.json(
      { ok: false, error: "Inbound email is not configured." },
      { status: 503 }
    );
  }

  const form = await request.formData();
  const valid = verifyMailgunSignature(
    {
      timestamp: String(form.get("timestamp") ?? ""),
      token: String(form.get("token") ?? ""),
      signature: String(form.get("signature") ?? ""),
    },
    signingKey
  );
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  const email = await parseMailgunWebhook(form);
  const recipient = findOurRecipient(email.to, mailDomain);
  if (!recipient) {
    console.warn("[inbound-email] no matching recipient", email.to);
    return NextResponse.json({ ok: true }); // not ours — acknowledge quietly
  }

  // org resolved from the public slug (pre-auth path, like login)
  const org = await prisma.organization.findUnique({
    where: { slug: recipient.slug },
    select: { id: true, currency: true, status: true },
  });
  if (!org || org.status !== "active") {
    console.warn("[inbound-email] unknown or suspended org slug", recipient.slug);
    return NextResponse.json({ ok: true });
  }

  const db = scopedDb(org.id);
  if (!(await checkRateLimit("upload", org.id))) {
    await deadLetter(db, org.id, email.from, email.subject, "rate limited");
    return NextResponse.json({ ok: true });
  }

  // sender must be an active user of THIS org — silent reject otherwise
  const sender = normalizeSender(email.from);
  const user = await db.user.findUnique({
    where: { orgId_email: { orgId: org.id, email: sender } },
    select: { id: true, email: true, status: true },
  });
  if (!user || user.status !== "active") {
    console.warn("[inbound-email] unknown sender", sender, "org", recipient.slug);
    await deadLetter(db, org.id, sender, email.subject, "unknown sender");
    return NextResponse.json({ ok: true });
  }

  if (email.attachments.length === 0) {
    await deadLetter(db, org.id, sender, email.subject, "no attachments");
    return NextResponse.json({ ok: true });
  }

  // fallback category (created once per org, documented behavior)
  let category = await db.category.findFirst({ where: { name: FALLBACK_CATEGORY } });
  category ??= await db.category.create({
    data: { orgId: org.id, name: FALLBACK_CATEGORY },
  });

  const purpose = subjectToPurpose(email.subject);
  const ctxForAudit = {
    userId: user.id,
    orgId: org.id,
    orgSlug: recipient.slug,
    role: "employee" as const,
  };
  let created = 0;

  for (const attachment of email.attachments) {
    const invalid = validateReceiptFile({
      name: attachment.fileName,
      type: attachment.contentType,
      size: attachment.content.length,
    });
    if (invalid) {
      await deadLetter(
        db, org.id, sender, email.subject,
        `attachment "${attachment.fileName}": ${invalid}`
      );
      continue;
    }

    // OCR first — the draft is prefilled from the receipt itself
    const ocr = await extractReceipt({
      buffer: attachment.content,
      mimeType: attachment.contentType,
    });
    const amount = ocr.amount ?? 1; // placeholder paisa when unreadable — flagged for review
    const date = ocr.date
      ? new Date(`${ocr.date}T00:00:00.000Z`)
      : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const merchant = ocr.merchant ?? "Emailed receipt";

    const policyFlags = await computeExpenseFlags(db, org.id, {
      expenseId: null,
      userId: user.id,
      amount,
      baseAmount: amount,
      date,
      merchant,
      categoryId: category.id,
      receiptCount: 1,
    });

    const expense = await db.expense.create({
      data: {
        orgId: org.id,
        userId: user.id,
        amount,
        baseAmount: amount,
        fxRate: "1",
        currency: org.currency,
        date,
        merchant,
        categoryId: category.id,
        purpose,
        flags: [EMAIL_FLAG, ...policyFlags],
      },
    });

    const key = buildReceiptKey(org.id, expense.id, attachment.fileName);
    await putReceiptObject({
      key,
      body: attachment.content,
      contentType: attachment.contentType,
      fileName: attachment.fileName,
    });
    await db.receipt.create({
      data: {
        orgId: org.id,
        expenseId: expense.id,
        storageKey: key,
        fileName: attachment.fileName,
        mimeType: attachment.contentType,
        sizeBytes: attachment.content.length,
        ocrData: Object.keys(ocr).length > 0 ? ocr : undefined,
      },
    });
    await logAudit(db, ctxForAudit, {
      entity: "Expense",
      entityId: expense.id,
      action: "expense.email_ingested",
      meta: { fileName: attachment.fileName, subject: purpose },
    });
    created += 1;
  }

  if (created > 0) {
    try {
      const title = `${created} expense${created === 1 ? "" : "s"} created from your email`;
      const body = `“${purpose || email.subject || "Your email"}” produced ${created} draft expense${created === 1 ? "" : "s"} — review before submitting. Unreadable receipts default to ${formatMoney(1, org.currency)}.`;
      await db.notification.create({
        data: {
          orgId: org.id,
          userId: user.id,
          type: "email.ingested",
          title,
          body,
          link: "/expenses",
        },
      });
      await sendEmail({ to: user.email, subject: title, text: body });
    } catch (e) {
      console.error("[inbound-email] notify failed:", e);
    }
  }

  return NextResponse.json({ ok: true, data: { created } });
}
