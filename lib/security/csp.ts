// Content Security Policy — ONE builder, used by middleware.ts for every
// document response.
//
// The policy used to be a static header in next.config.ts with
// `script-src 'self' 'unsafe-inline'`, because Next's App Router inlines its
// hydration bootstrap and a static header cannot know a per-request nonce.
// 'unsafe-inline' for scripts is the directive that makes a CSP decorative:
// any injected <script> runs. Middleware now mints a nonce per request and
// puts it in BOTH the request headers (Next reads it from there and stamps it
// on every inline script it emits) and the response header (what the browser
// enforces). `'strict-dynamic'` lets scripts the nonced bootstrap creates —
// Next's chunk loader appends <script> elements — run without each needing a
// nonce, which is how a hashed/nonced policy stays workable with a bundler.
//
// The loose directives that remain are deliberate:
//   - img-src allows https: because receipt tiles render from short-lived
//     PRESIGNED URLs on whatever S3-compatible host the deploy points at
//     (MinIO locally, R2 in production). Pinning a host here would break
//     receipts the first time that endpoint changes.
//   - style-src keeps 'unsafe-inline': framer-motion and Radix write inline
//     style attributes, and a style nonce does not cover attributes.
//   - frame-ancestors 'none' is the one that matters most for a finance
//     app: it is what X-Frame-Options says, but enforced by browsers that
//     have dropped the older header.
//   - 'unsafe-eval' in DEVELOPMENT ONLY. Next's dev bundler evaluates module
//     code with eval for hot reload, so a policy without it silently blocks
//     every client script — the page still renders (it is server-rendered),
//     but nothing hydrates. The failure is genuinely nasty: forms fall back
//     to NATIVE submission, so the signup form once issued
//       GET /signup?...&password=Password123!
//     putting the password in the URL and the access log. Caught by the e2e
//     happy path, which is what exercises interactivity in CI.

export type CspOptions = {
  /** Base64 nonce for this request. Never reuse one across requests. */
  nonce: string;
  /** `true` under `next dev`; adds 'unsafe-eval' for hot reload. */
  dev: boolean;
};

export function buildCsp({ nonce, dev }: CspOptions): string {
  if (!/^[A-Za-z0-9+/=_-]{16,}$/.test(nonce)) {
    throw new Error("csp: nonce must be at least 16 base64 characters");
  }
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(dev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    "connect-src 'self' https:",
  ].join("; ");
}

/**
 * Headers that need no per-request input. Set from next.config.ts so they
 * also cover static assets, which middleware does not run for.
 */
export const STATIC_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
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
