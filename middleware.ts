import { NextResponse, type NextRequest } from "next/server";

import { buildCsp } from "@/lib/security/csp";

// Per-request CSP nonce (docs/PRODUCTION-CHECKLIST.md, formerly open item 1).
//
// Next reads the nonce out of the Content-Security-Policy header on the
// REQUEST and stamps it on every inline script it emits for the document —
// the hydration bootstrap, the streamed-boundary reveal scripts, the RSC
// payload pushes. The same policy goes on the RESPONSE, which is the copy the
// browser enforces. Both are needed: the request copy without the response
// copy nonces scripts nobody checks; the response copy without the request
// copy blocks Next's own bootstrap and the page never hydrates.
//
// The nonce is 16 random bytes, base64. It must differ per response —
// a repeated nonce is 'unsafe-inline' with extra steps.
export function middleware(request: NextRequest) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV !== "production" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Documents and route handlers, not static assets — those get the
      // static headers from next.config.ts and carry no inline script.
      // Router prefetches are skipped so a prefetch cannot cache a response
      // whose nonce does not match the page that later renders it.
      source: "/((?!_next/static|_next/image|favicon.ico|fonts/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
