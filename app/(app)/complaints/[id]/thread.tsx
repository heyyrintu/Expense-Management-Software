"use client";

// Complaint thread (D4.3) — DESIGN-PRD §7.7: "thread layout like a support
// conversation … composer pinned bottom".
//
// ── LIKE A SUPPORT CONVERSATION, NOT LIKE A CHAT APP ──────────────────────
// §7.7 asks for a support conversation, and the distinction from a messaging
// UI is the whole design. No bubbles, no tails, no alternating left/right
// alignment. Every message starts at the same left edge with the same avatar,
// name and timestamp, and reads as a record — which is what it is: this
// thread is evidence in a dispute about money, and it gets printed, quoted
// and read back months later.
//
// Own messages are differentiated SUBTLY — a tinted avatar and a "You" label
// — and not by moving them to the other side of the screen. Right-aligned
// messages destroy the scannable left edge that makes a long thread readable,
// and in a two-party dispute the reader already knows which half is theirs.
//
// The composer is pinned to the bottom of the thread panel rather than the
// viewport: it belongs to the conversation, and a bar floating over the whole
// page would cover the complaint header the reader is replying about.
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar } from "@/components/shell/avatar-menu";
import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { postComplaintMessageAction } from "../actions";

export type ThreadMessage = {
  id: string;
  authorName: string;
  body: string;
  /** ISO instant — DateCell formats it. */
  when: string;
  mine: boolean;
};

export function ComplaintThread({
  complaintId,
  messages,
  closed = false,
}: {
  complaintId: string;
  messages: ThreadMessage[];
  /** The complaint is resolved. The thread STAYS open — see the note below. */
  closed?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (text.length === 0) return;
    const form = new FormData();
    form.set("complaintId", complaintId);
    form.set("body", text);
    startTransition(async () => {
      const res = await postComplaintMessageAction(form);
      if (!res.ok) {
        toast.error(res.error ?? "That didn't send.");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <section className="border-line bg-bg-surface grid content-start rounded-lg border">
      <h2 className="border-line text-h3 text-text-primary border-b px-4 py-3">
        Conversation
      </h2>

      <ol className="divide-line grid divide-y">
        {messages.map((message) => (
          <li key={message.id} className="flex gap-3 px-4 py-4">
            <Avatar
              name={message.authorName}
              className={cn(
                "mt-0.5 shrink-0",
                // The whole differentiation: a quieter avatar for your own
                // messages. Enough to scan by, not enough to split the thread
                // into two columns.
                message.mine && "bg-bg-subtle text-text-secondary"
              )}
            />
            <div className="grid min-w-0 flex-1 gap-1">
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-label text-text-primary">
                  {message.mine ? "You" : message.authorName}
                </span>
                {/* Relative is right HERE and nowhere near money: this is an
                    activity timestamp, and "2 hours ago" is what a reader
                    wants from a conversation (CLAUDE.md). */}
                <DateCell value={message.when} format="relative" tone="muted" />
              </span>
              <p className="text-body text-text-secondary whitespace-pre-wrap">
                {message.body}
              </p>
            </div>
          </li>
        ))}

        {messages.length === 0 ? (
          <li className="text-body text-text-secondary px-4 py-6">
            No replies yet. Add anything that helps — a date, an amount, what
            you expected to see.
          </li>
        ) : null}
      </ol>

      {/* Pinned to the bottom of the panel. It stays available after the
          complaint closes on purpose: the record is frozen, the conversation
          is not, and an employee who is still unhappy needs somewhere to say
          so other than raising a second complaint. */}
      <form
        onSubmit={submit}
        className="border-line bg-bg-subtle sticky bottom-0 grid gap-2 rounded-b-lg border-t p-4"
      >
        <label>
          <span className="sr-only">Write a reply</span>
          <Textarea
            rows={3}
            value={body}
            maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              closed
                ? "This complaint is closed, but you can still reply."
                : "Write a reply…"
            }
            className="bg-bg-surface"
          />
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || body.trim().length === 0}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </section>
  );
}
