// WhatsApp number linking — the UI state machine (D4.4).
//
// The task asks for "idle → code sent → verifying → linked, rendered as clear
// inline states". Writing that as a union rather than three booleans is the
// difference between a panel that can be reasoned about and one that can be
// in two states at once — "sending" and "linked" together, or a code box with
// no number behind it.
//
// This is the CLIENT's view of the flow. The server owns the truth (a
// WhatsAppLink row with `verifiedAt` and `otpHash`), and the panel resolves
// its starting state from that; the states below only describe what the
// reader is doing right now.
export type WhatsAppLinkState =
  /** No number entered, or a previous attempt abandoned. */
  | { kind: "idle" }
  /** Sending the number to the server, waiting for the code to go out. */
  | { kind: "sending"; phone: string }
  /** The code is on its way to the reader's phone. Awaiting six digits. */
  | { kind: "code_sent"; phone: string }
  /** Six digits submitted, server checking. */
  | { kind: "verifying"; phone: string }
  /** Done — the number is verified and receipts can arrive from it. */
  | { kind: "linked"; phone: string };

export type WhatsAppLinkEvent =
  | { type: "submit_number"; phone: string }
  | { type: "code_sent" }
  | { type: "submit_code" }
  | { type: "verified" }
  /** A server refusal at any point returns to the last stable state. */
  | { type: "failed" }
  | { type: "change_number" }
  | { type: "unlinked" };

/** Where a freshly loaded page starts, from what the server knows. */
export function initialLinkState(input: {
  status: "none" | "pending" | "linked";
  phone: string | null;
}): WhatsAppLinkState {
  if (input.status === "linked" && input.phone) {
    return { kind: "linked", phone: input.phone };
  }
  if (input.status === "pending" && input.phone) {
    // A code was sent and never confirmed — resume there rather than making
    // the reader re-enter a number the server already has.
    return { kind: "code_sent", phone: input.phone };
  }
  return { kind: "idle" };
}

/**
 * The transition table.
 *
 * Unknown pairs return the CURRENT state unchanged rather than throwing: a
 * double-clicked button or a late response should be a no-op, not a crash on
 * a screen someone is halfway through.
 *
 * Note where `failed` lands. From `sending` it goes back to `idle`, because
 * the number was refused and the reader must retype it. From `verifying` it
 * goes back to `code_sent`, because the CODE was wrong and the number is
 * still fine — sending them back to the number field would make a typo in
 * six digits cost the whole flow.
 */
export function nextLinkState(
  state: WhatsAppLinkState,
  event: WhatsAppLinkEvent
): WhatsAppLinkState {
  if (event.type === "unlinked") return { kind: "idle" };

  switch (state.kind) {
    case "idle":
      return event.type === "submit_number"
        ? { kind: "sending", phone: event.phone }
        : state;

    case "sending":
      if (event.type === "code_sent") return { kind: "code_sent", phone: state.phone };
      if (event.type === "failed") return { kind: "idle" };
      return state;

    case "code_sent":
      if (event.type === "submit_code") return { kind: "verifying", phone: state.phone };
      if (event.type === "change_number") return { kind: "idle" };
      return state;

    case "verifying":
      if (event.type === "verified") return { kind: "linked", phone: state.phone };
      // The number survives a bad code.
      if (event.type === "failed") return { kind: "code_sent", phone: state.phone };
      return state;

    case "linked":
      return state;
  }
}

/** True while a request is in flight — the panel disables its controls. */
export function isBusy(state: WhatsAppLinkState): boolean {
  return state.kind === "sending" || state.kind === "verifying";
}

/** The line of explanation under the current step. */
export function linkStateHint(state: WhatsAppLinkState): string {
  switch (state.kind) {
    case "idle":
      return "Indian numbers can be entered without the country code.";
    case "sending":
      return "Sending a code to that number…";
    case "code_sent":
      return `We sent a 6-digit code to ${state.phone} on WhatsApp. It expires in 10 minutes.`;
    case "verifying":
      return "Checking that code…";
    case "linked":
      return "Send a receipt photo to our WhatsApp number and it becomes a draft expense.";
  }
}
