import type { NextConfig } from "next";

// Security headers. This file was empty, so the app shipped with none of
// these — no clickjacking defence, no MIME-sniff defence, no HSTS.
//
// CSP notes, because the loose directives here are deliberate rather than
// lazy:
//   - script-src keeps 'unsafe-inline': Next's App Router inlines its
//     hydration bootstrap, and removing it needs a per-request nonce from
//     middleware. That is a real change with a real regression risk, so it
//     is a follow-up, not a drive-by.
//   - img-src allows https: because receipt tiles render from short-lived
//     PRESIGNED URLs on whatever S3-compatible host the deploy points at
//     (MinIO locally, R2 in production). Pinning a host here would break
//     receipts the first time that endpoint changes.
//   - frame-ancestors 'none' is the one that matters most for a finance
//     app: it is what X-Frame-Options says, but enforced by browsers that
//     have dropped the older header.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Two years, subdomains included. Browsers ignore this over plain HTTP,
  // so it is inert in local development rather than something to gate.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Do not advertise the framework version to scanners.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
