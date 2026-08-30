// Constant-time Bearer check for machine callers (cron, scheduled jobs).
//
// `provided !== `Bearer ${secret}`` compares byte-by-byte and returns on the
// first mismatch, so how long it takes leaks how much of the prefix was
// right. That is a real oracle against a secret an attacker can probe as
// fast as the endpoint answers. timingSafeEqual always reads both buffers.
//
// Fails CLOSED when CRON_SECRET is unset: an unconfigured deployment must
// not expose an open job endpoint that mutates every org's data.
import { timingSafeEqual } from "node:crypto";

export function bearerMatches(
  header: string | null | undefined,
  secret: string | undefined
): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const received = Buffer.from(header, "utf8");
  // Length is not secret (it is implied by the header), and timingSafeEqual
  // throws on a length mismatch, so this guard has to come first.
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
