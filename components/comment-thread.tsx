"use client";

// Shared report discussion thread (5.3) — rendered on the owner's report
// page and the approver's review page.
import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DateCell } from "@/components/ui/date-cell";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addReportCommentAction } from "@/app/(app)/reports/comment-actions";

export type CommentView = {
  id: string;
  authorName: string;
  body: string;
  /** Raw timestamp — rendered through <DateCell>, never pre-formatted. */
  when: Date | string;
  mine: boolean;
};

export function CommentThread({
  reportId,
  comments,
}: {
  reportId: string;
  comments: CommentView[];
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function post() {
    setError(null);
    if (body.trim() === "") return;
    startTransition(async () => {
      const res = await addReportCommentAction({ reportId, body });
      if (!res.ok) {
        setError(res.error);
      } else {
        setBody("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid max-w-md gap-3 rounded-xl border p-4">
      <h2 className="text-sm font-medium">
        Discussion{comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>
      {comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No comments yet — questions and clarifications live here.
        </p>
      ) : (
        <ul className="grid gap-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={cn(
                "grid gap-0.5 rounded-lg border p-2 text-sm",
                c.mine && "bg-muted/50"
              )}
            >
              <span className="flex justify-between gap-2">
                <span className="font-medium">{c.mine ? "You" : c.authorName}</span>
                <DateCell value={c.when} tone="muted" />
              </span>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2">
        <label htmlFor={`comment-${reportId}`} className="sr-only">
          Add a comment
        </label>
        <Textarea
          id={`comment-${reportId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ask a question or add context…"
          maxLength={1000}
        />
        {error ? (
          <p role="alert" className="text-destructive text-sm">{error}</p>
        ) : null}
        <div>
          <Button size="sm" disabled={pending || body.trim() === ""} onClick={post}>
            {pending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
