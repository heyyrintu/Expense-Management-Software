import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

import { STATIC_SECURITY_HEADERS } from "./lib/security/csp";

// Security headers. This file was empty once, so the app shipped with none
// of these — no clickjacking defence, no MIME-sniff defence, no HSTS.
//
// The Content-Security-Policy is NOT here: it needs a per-request nonce for
// Next's inline bootstrap, and a static header cannot carry one, which is
// how the policy came to allow 'unsafe-inline' for scripts. middleware.ts
// mints the nonce and sets the policy on every document; the builder and
// the reasoning behind each directive live in lib/security/csp.ts. What
// stays here is the set of headers that need no per-request input, applied
// to every path so static assets get them too.
const securityHeaders = [...STATIC_SECURITY_HEADERS];

const nextConfig: NextConfig = {
  // Standalone ONLY for the container build. It traces the server and its
  // dependencies into .next/standalone so the runtime image copies one
  // directory instead of installing node_modules again — but it also makes
  // `next start` refuse to serve ("next start does not work with output:
  // standalone"), which is how CI runs the browser suites. The Dockerfile
  // sets NEXT_OUTPUT=standalone; nothing else does.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Do not advertise the framework version to scanners.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// ANALYZE=true npm run build writes .next/analyze/client.json — the per-module
// breakdown docs/PERF-AUDIT.md §3 is read from. Off by default; costs nothing.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  analyzerMode: "json",
  openAnalyzer: false,
});

export default withBundleAnalyzer(nextConfig);
