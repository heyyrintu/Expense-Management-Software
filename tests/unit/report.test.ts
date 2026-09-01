import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError, reportSecurityEvent } from "@/lib/observability/report";

function captured(fn: () => void): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((s: unknown) => {
    lines.push(JSON.parse(String(s)));
  });
  fn();
  spy.mockRestore();
  return lines;
}

afterEach(() => vi.restoreAllMocks());

describe("reportError", () => {
  it("emits one parseable JSON object per error", () => {
    const [line] = captured(() =>
      reportError(new Error("boom"), { at: "boundary:(app)", digest: "d1" })
    );
    expect(line.level).toBe("error");
    expect(line.at).toBe("boundary:(app)");
    expect(line.message).toBe("boom");
    expect(line.digest).toBe("d1");
    expect(typeof line.stack).toBe("string");
  });

  it("handles a thrown non-Error without losing it", () => {
    const [line] = captured(() => reportError("just a string", { at: "x" }));
    expect(line.message).toBe("just a string");
    expect(line.stack).toBeUndefined();
  });

  // A reporter that throws turns a handled error into an unhandled one.
  it("never throws, even when serialising fails", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() =>
      reportError(new Error("x"), { at: "y", meta: cyclic as never })
    ).not.toThrow();
  });

  it("reports security events with a countable name", () => {
    const [line] = captured(() =>
      reportSecurityEvent("whatsapp.bad_signature", { phoneNumberId: "PN-1" })
    );
    expect(line.at).toBe("security:whatsapp.bad_signature");
    expect(line.meta).toEqual({ phoneNumberId: "PN-1" });
  });
});
