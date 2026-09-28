import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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

  it("embeds nothing from the storage host: no plugins, no cross-origin frames", () => {
    const csp = buildCsp({ nonce: NONCE, dev: false });
    expect(directive(csp, "object-src")).toBe("'none'");
    // No frame-src of its own, so frames fall back to default-src 'self' —
    // a presigned receipt URL on MinIO or R2 can never be framed.
    expect(csp.split("; ").some((d) => d.startsWith("frame-src "))).toBe(false);
    expect(directive(csp, "default-src")).toBe("'self'");
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

// The policy above blocks <object>/<embed> outright and every cross-origin
// <iframe>. A component that renders one anyway ships a box that silently
// stays empty — which is how PDF receipt previews and both PDF viewers broke
// when the CSP landed (they now open the file in a new tab; see
// components/ui/pdf-open-panel.tsx). So any new one fails here instead.
describe("markup the CSP would block", () => {
  function* sources(dir: string): Generator<string> {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) yield* sources(full);
      else if (full.endsWith(".tsx")) yield full;
    }
  }

  it("no component renders <object>, <embed> or <iframe>", () => {
    const offenders: string[] = [];
    for (const root of ["app", "components"]) {
      for (const file of sources(root)) {
        const code = readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");
        if (/<(object|embed|iframe)[\s>]/.test(code)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
