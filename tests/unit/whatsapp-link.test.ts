// WhatsApp linking state machine (D4.4).
//
// An OTP flow is where "three booleans" UIs go wrong, so this is a table with
// one current state and one event. The interesting assertions are about where
// a FAILURE lands — that's the difference between a recoverable typo and
// starting over.
import { describe, expect, it } from "vitest";

import {
  initialLinkState,
  isBusy,
  linkStateHint,
  nextLinkState,
  type WhatsAppLinkState,
} from "@/lib/domain/whatsapp-link";

const PHONE = "+91 98765 43210";

describe("initialLinkState", () => {
  it("starts idle with nothing on file", () => {
    expect(initialLinkState({ status: "none", phone: null })).toEqual({ kind: "idle" });
  });

  it("resumes at the code step when a code was already sent", () => {
    // The server has the number and an unconfirmed OTP. Making the reader
    // retype a number the server already holds would be busywork.
    expect(initialLinkState({ status: "pending", phone: PHONE })).toEqual({
      kind: "code_sent",
      phone: PHONE,
    });
  });

  it("starts linked when verified", () => {
    expect(initialLinkState({ status: "linked", phone: PHONE })).toEqual({
      kind: "linked",
      phone: PHONE,
    });
  });

  it("falls back to idle if a status arrives without a number", () => {
    // Defensive: a code_sent state with no phone would render a verify box
    // for nothing.
    expect(initialLinkState({ status: "pending", phone: null })).toEqual({ kind: "idle" });
    expect(initialLinkState({ status: "linked", phone: null })).toEqual({ kind: "idle" });
  });
});

describe("nextLinkState — the happy path", () => {
  it("walks idle → sending → code_sent → verifying → linked", () => {
    let state: WhatsAppLinkState = { kind: "idle" };
    state = nextLinkState(state, { type: "submit_number", phone: PHONE });
    expect(state).toEqual({ kind: "sending", phone: PHONE });
    state = nextLinkState(state, { type: "code_sent" });
    expect(state).toEqual({ kind: "code_sent", phone: PHONE });
    state = nextLinkState(state, { type: "submit_code" });
    expect(state).toEqual({ kind: "verifying", phone: PHONE });
    state = nextLinkState(state, { type: "verified" });
    expect(state).toEqual({ kind: "linked", phone: PHONE });
  });

  it("carries the number through every step without re-asking", () => {
    let state: WhatsAppLinkState = { kind: "idle" };
    for (const event of [
      { type: "submit_number", phone: PHONE },
      { type: "code_sent" },
      { type: "submit_code" },
      { type: "verified" },
    ] as const) {
      state = nextLinkState(state, event);
      if (state.kind !== "idle") expect(state.phone).toBe(PHONE);
    }
  });
});

describe("nextLinkState — where failures land", () => {
  it("sends a REFUSED NUMBER back to idle", () => {
    // The number itself was rejected, so it has to be retyped.
    const state = nextLinkState({ kind: "sending", phone: PHONE }, { type: "failed" });
    expect(state).toEqual({ kind: "idle" });
  });

  it("keeps the number when the CODE is wrong", () => {
    // The one that matters. A mistyped digit must not cost the reader the
    // number they already entered and had a code sent to — otherwise a typo
    // in six digits restarts the whole flow and burns another OTP.
    const state = nextLinkState({ kind: "verifying", phone: PHONE }, { type: "failed" });
    expect(state).toEqual({ kind: "code_sent", phone: PHONE });
  });

  it("lets the reader deliberately change number from the code step", () => {
    expect(
      nextLinkState({ kind: "code_sent", phone: PHONE }, { type: "change_number" })
    ).toEqual({ kind: "idle" });
  });

  it("returns to idle on unlink, from anywhere", () => {
    for (const state of [
      { kind: "linked", phone: PHONE },
      { kind: "code_sent", phone: PHONE },
      { kind: "idle" },
    ] as WhatsAppLinkState[]) {
      expect(nextLinkState(state, { type: "unlinked" })).toEqual({ kind: "idle" });
    }
  });
});

describe("nextLinkState — unknown pairs are no-ops", () => {
  it("ignores an event that doesn't apply, rather than throwing", () => {
    // A double-clicked button or a late response must not crash a screen
    // somebody is halfway through.
    const linked: WhatsAppLinkState = { kind: "linked", phone: PHONE };
    expect(nextLinkState(linked, { type: "submit_code" })).toBe(linked);
    expect(nextLinkState({ kind: "idle" }, { type: "verified" })).toEqual({ kind: "idle" });
  });

  it("cannot be verified straight from idle", () => {
    // No path skips the code step.
    expect(nextLinkState({ kind: "idle" }, { type: "code_sent" })).toEqual({ kind: "idle" });
  });
});

describe("isBusy", () => {
  it("is true exactly while a request is in flight", () => {
    expect(isBusy({ kind: "sending", phone: PHONE })).toBe(true);
    expect(isBusy({ kind: "verifying", phone: PHONE })).toBe(true);
    expect(isBusy({ kind: "idle" })).toBe(false);
    expect(isBusy({ kind: "code_sent", phone: PHONE })).toBe(false);
    expect(isBusy({ kind: "linked", phone: PHONE })).toBe(false);
  });
});

describe("linkStateHint", () => {
  it("names the number the code went to", () => {
    // "Check your phone" is useless if the reader can't see WHICH number.
    expect(linkStateHint({ kind: "code_sent", phone: PHONE })).toContain(PHONE);
  });

  it("has a distinct line for every state", () => {
    const hints = (
      [
        { kind: "idle" },
        { kind: "sending", phone: PHONE },
        { kind: "code_sent", phone: PHONE },
        { kind: "verifying", phone: PHONE },
        { kind: "linked", phone: PHONE },
      ] as WhatsAppLinkState[]
    ).map(linkStateHint);
    expect(new Set(hints).size).toBe(5);
  });
});
