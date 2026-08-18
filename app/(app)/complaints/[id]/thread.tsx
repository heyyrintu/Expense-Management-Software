"use client";

// Complaint thread — stays open after the complaint is resolved so the
// employee can still come back on it.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postComplaintMessageAction } from "../actions";

export type ThreadMessage = {
  id: string;
  authorName: string;
  body: string;
  when: string;
  mine: boolean;
};

export function ComplaintThread({
  complaintId,
  messages,
}: {
  complaintId: string;
  messages: ThreadMessage[];
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length === 0) return;
    setError(null);
    const form = new FormData();
    form.set("complaintId", complaintId);
    form.set("body", body.trim());
    startTransition(async () => {
      const res = await postComplaintMessageAction(form);
      if (!res.ok) setError(res.error);
      else {
        setBody("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-3">
      <h2 className="text-sm font-semibold">Conversation</h2>
      {messages.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No replies yet — ask a question or add anything that helps.
        </p>
      ) : (
        <ul className="grid gap-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-lg border p-3 text-sm ${m.mine ? "bg-accent/40" : ""}`}
            >
              <p className="text-muted-foreground text-xs">
                {m.authorName} · {m.when}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="grid gap-2">
        <label htmlFor="complaint-reply" className="sr-only">
          Write a reply
        </label>
        <Textarea
          id="complaint-reply"
          rows={3}
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a reply…"
        />
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" size="sm" disabled={pending || body.trim().length === 0}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
