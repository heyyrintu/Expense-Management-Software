import { describe, expect, it } from "vitest";

import { STATIC_SECURITY_HEADERS, buildCsp } from "@/lib/security/csp";

const NONCE = "c2FtcGxlLW5vbmNlLTE2Ynl0ZXM=";

function directive(csp: string, name: string): string {
  const found = csp.split("; ").find((d) => d.startsWith(`${name} `));
  if (!found) throw new Error(`no ${name} directive in: ${csp}`);
  return found.slice(name.length + 1);
}

describe("buildCsp", () => {
  it("nonces scripts and never allows 'unsafe-inline' for them", () => {
    const csp = buildCsp({ nonce: NONCE, dev: false });
    const script = directive(csp, "script-src");
    expect(script).toContain(`'nonce-${NONCE}'`);
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("adds 'unsafe-eval' only for the dev bundler", () => {
    expect(directive(buildCsp({ nonce: NONCE, dev: true }), "script-src")).toContain("'unsafe-eval'");
    expect(directive(buildCsp({ nonce: NONCE, dev: false }), "script-src")).not.toContain(
      "'unsafe-eval'"
    );
  });

  it("keeps the directives a finance app cannot loosen", () => {
    const csp = buildCsp({ nonce: NONCE, dev: false });
    expect(directive(csp, "frame-ancestors")).toBe("'none'");
    expect(directive(csp, "object-src")).toBe("'none'");
    expect(directive(csp, "base-uri")).toBe("'self'");
    expect(directive(csp, "form-action")).toBe("'self'");
    // Receipts are presigned URLs on whichever S3 host the deploy uses.
    expect(directive(csp, "img-src")).toContain("https:");
  });

  it("refuses a nonce too short to be unguessable", () => {
    expect(() => buildCsp({ nonce: "abc", dev: false })).toThrow(/nonce/);
  });

  it("zod runs jitless in the browser bundle, so its eval probe never trips the policy", async () => {
    await import("@/lib/zod-csp");
    const { z } = await import("zod");
    expect(z.config().jitless).toBe(true);
  });

  it("static headers carry no CSP — that is the middleware's job", () => {
    expect(STATIC_SECURITY_HEADERS.map((h) => h.key)).not.toContain("Content-Security-Policy");
    expect(STATIC_SECURITY_HEADERS.map((h) => h.key)).toEqual(
      expect.arrayContaining(["X-Content-Type-Options", "X-Frame-Options", "Strict-Transport-Security"])
    );
  });
});
