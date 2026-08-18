// Pending-approvals email digest (PLAN 5.6) — pure formatting, unit-tested
// in tests/unit/digest.test.ts.
import { formatMoney } from "@/lib/money";

export type DigestItem = {
  title: string;
  ownerName: string;
  total: number;
  submittedAt: Date | null;
  level: 1 | 2;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function oldestAgeDays(items: DigestItem[], now: Date): number {
  let oldest = 0;
  for (const i of items) {
    if (!i.submittedAt) continue;
    const days = Math.floor((now.getTime() - i.submittedAt.getTime()) / DAY_MS);
    if (days > oldest) oldest = days;
  }
  return oldest;
}

export function buildApprovalDigest(
  items: DigestItem[],
  currency: string,
  now: Date,
  appUrl: string
): { subject: string; text: string } {
  const total = items.reduce((acc, i) => acc + i.total, 0);
  const oldest = oldestAgeDays(items, now);
  const subject = `${items.length} report${items.length === 1 ? "" : "s"} awaiting your approval (${formatMoney(total, currency)})`;

  const lines = items
    .slice(0, 20)
    .map(
      (i) =>
        `  • ${i.title} — ${i.ownerName} — ${formatMoney(i.total, currency)}${i.level === 2 ? " (2nd approval)" : ""}`
    );
  const more = items.length > 20 ? `  …and ${items.length - 20} more\n` : "";
  const aging =
    oldest > 0
      ? `The oldest has been waiting ${oldest} day${oldest === 1 ? "" : "s"}.\n\n`
      : "";

  const text =
    `You have ${items.length} expense report${items.length === 1 ? "" : "s"} waiting for your decision, ` +
    `totalling ${formatMoney(total, currency)}.\n\n` +
    aging +
    lines.join("\n") +
    (lines.length ? "\n" : "") +
    more +
    `\nReview them: ${appUrl.replace(/\/$/, "")}/approvals\n`;

  return { subject, text };
}
