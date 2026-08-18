// Mailgun inbound-route webhook adapter (6.6).
//
// Setup (documented for ops):
//   1. Mailgun → Receiving → Create route: match_recipient("receipts+.*@<APP_MAIL_DOMAIN>")
//      → forward("https://<host>/api/webhooks/inbound-email")
//   2. Env: MAILGUN_WEBHOOK_SIGNING_KEY (HTTP webhook signing key),
//           APP_MAIL_DOMAIN (e.g. mail.yourapp.com)
//
// Mailgun signs each POST with HMAC-SHA256(timestamp + token, signing key).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { InboundEmail } from "./types";

export const SIGNATURE_MAX_AGE_SECONDS = 300;

/** Pure signature check — unit-tested with a known key. */
export function verifyMailgunSignature(
  params: { timestamp: string; token: string; signature: string },
  signingKey: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!params.timestamp || !params.token || !params.signature) return false;
  const ts = Number.parseInt(params.timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > SIGNATURE_MAX_AGE_SECONDS) {
    return false; // replay window exceeded
  }
  const expected = createHmac("sha256", signingKey)
    .update(params.timestamp + params.token)
    .digest("hex");
  const a = Buffer.from(params.signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Mailgun "forward" posts multipart form data. */
export async function parseMailgunWebhook(form: FormData): Promise<InboundEmail> {
  const attachments = [];
  const count = Number.parseInt(String(form.get("attachment-count") ?? "0"), 10) || 0;
  for (let i = 1; i <= count; i++) {
    const file = form.get(`attachment-${i}`);
    if (file instanceof File && file.size > 0) {
      attachments.push({
        fileName: file.name || `attachment-${i}`,
        contentType: file.type || "application/octet-stream",
        content: Buffer.from(await file.arrayBuffer()),
      });
    }
  }
  const recipients = String(form.get("recipient") ?? "")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  return {
    from: String(form.get("sender") ?? form.get("from") ?? "").toLowerCase(),
    to: recipients,
    subject: String(form.get("subject") ?? ""),
    attachments,
  };
}
