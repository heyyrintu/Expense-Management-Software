"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createClientAction,
  deleteClientAction,
  updateClientAction,
} from "./actions";

type Row = { id: string; name: string; code: string; expenseCount: number };

export function ClientsPanel({ clients }: { clients: Row[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setName("");
        setCode("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid max-w-lg gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createClientAction({ name, code }));
        }}
      >
        <label htmlFor="cl-name" className="sr-only">Client name</label>
        <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
        <label htmlFor="cl-code" className="sr-only">Code</label>
        <Input id="cl-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CODE" className="w-28" />
        <Button type="submit" disabled={pending || !name.trim() || !code.trim()}>
          Add
        </Button>
      </form>

      {clients.length === 0 ? (
        <p className="text-text-tertiary text-sm">No clients yet.</p>
      ) : (
        <ul className="grid gap-2">
          {clients.map((c) => (
            <ClientRow key={c.id} client={c} run={run} pending={pending} />
          ))}
        </ul>
      )}
      {error ? <p role="alert" className="text-status-danger-text text-sm">{error}</p> : null}
    </div>
  );
}

function ClientRow({
  client,
  run,
  pending,
}: {
  client: Row;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  pending: boolean;
}) {
  const [name, setName] = React.useState(client.name);
  const [code, setCode] = React.useState(client.code);
  const dirty = name.trim() !== client.name || code.trim() !== client.code;

  return (
    <li className="flex items-center gap-2 rounded-lg border p-2">
      <label htmlFor={`cln-${client.id}`} className="sr-only">Name</label>
      <Input id={`cln-${client.id}`} value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      <label htmlFor={`clc-${client.id}`} className="sr-only">Code</label>
      <Input id={`clc-${client.id}`} value={code} onChange={(e) => setCode(e.target.value)} className="h-8 w-24" />
      <span className="text-text-tertiary whitespace-nowrap text-xs">
        {client.expenseCount} exp
      </span>
      {dirty ? (
        <Button size="sm" disabled={pending} onClick={() => run(() => updateClientAction({ id: client.id, name, code }))}>
          Save
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        className="text-status-danger-text"
        disabled={pending || client.expenseCount > 0}
        title={client.expenseCount > 0 ? "Has billable expenses" : undefined}
        onClick={() => run(() => deleteClientAction({ id: client.id }))}
      >
        Delete
      </Button>
    </li>
  );
}
