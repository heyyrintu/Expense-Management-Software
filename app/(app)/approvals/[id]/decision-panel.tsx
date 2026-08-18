"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decideReportAction } from "../actions";

export function DecisionPanel({
  reportId,
  level,
  required,
  flagged,
}: {
  reportId: string;
  level: 1 | 2;
  required: 1 | 2;
  flagged: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function decide(action: "approve" | "reject" | "send_back") {
    setError(null);
    if ((action === "reject" || action === "send_back") && reason.trim() === "") {
      setError("A reason is required to reject or send back.");
      return;
    }
    if (action === "approve" && flagged && reason.trim() === "") {
      setError("This report has policy flags — add a justification to approve.");
      return;
    }
    startTransition(async () => {
      const res = await decideReportAction({
        reportId,
        action,
        reason: reason.trim() === "" ? undefined : reason.trim(),
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        router.push("/approvals");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid max-w-md gap-3 rounded-xl border p-4">
      <h2 className="font-medium">
        Your decision
        {required === 2 ? ` (level ${level} of 2)` : ""}
      </h2>
      {flagged ? (
        <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
          This report has policy flags. You may still approve it, but a written
          justification is required and will be logged.
        </p>
      ) : null}
      <div className="grid gap-1">
        <label htmlFor="decision-reason" className="text-sm">
          Reason{" "}
          <span className="text-muted-foreground">
            (required for reject / send back{flagged ? " — and to approve a flagged report" : ""})
          </span>
        </label>
        <Textarea
          id="decision-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Missing receipt for the hotel stay…"
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">{error}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => decide("approve")}>
          {pending ? "Working…" : level === 1 && required === 2 ? "Approve (1st of 2)" : "Approve"}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => decide("send_back")}>
          Send back
        </Button>
        <Button variant="destructive" disabled={pending} onClick={() => decide("reject")}>
          Reject
        </Button>
      </div>
    </div>
  );
}
