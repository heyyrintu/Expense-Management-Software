// Address scheme (6.6): receipts+{orgslug}@APP_MAIL_DOMAIN — pure,
// unit-tested in tests/unit/inbound-email.test.ts.

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Extract the org slug from an inbound address, or null when not ours. */
export function parseInboundAddress(
  address: string,
  mailDomain: string
): { slug: string } | null {
  const cleaned = address.trim().toLowerCase();
  // tolerate "Name <addr>" forms
  const angled = /<([^>]+)>/.exec(cleaned);
  const addr = (angled ? angled[1] : cleaned).trim();
  const at = addr.lastIndexOf("@");
  if (at < 0) return null;
  const local = addr.slice(0, at);
  const domain = addr.slice(at + 1);
  if (domain !== mailDomain.toLowerCase()) return null;
  if (!local.startsWith("receipts+")) return null;
  const slug = local.slice("receipts+".length);
  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 32) return null;
  return { slug };
}

/** First of the recipients that matches our scheme. */
export function findOurRecipient(
  recipients: string[],
  mailDomain: string
): { slug: string } | null {
  for (const r of recipients) {
    const hit = parseInboundAddress(r, mailDomain);
    if (hit) return hit;
  }
  return null;
}

/** Sender address normalized for user matching. */
export function normalizeSender(from: string): string {
  const angled = /<([^>]+)>/.exec(from);
  return (angled ? angled[1] : from).trim().toLowerCase();
}

/** Email subject → expense purpose: strip reply/forward prefixes, cap length. */
export function subjectToPurpose(subject: string): string {
  return subject
    .replace(/^\s*((re|fwd?|fw)\s*:\s*)+/i, "")
    .trim()
    .slice(0, 200);
}
