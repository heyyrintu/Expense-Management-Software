"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createDepartmentAction,
  deleteDepartmentAction,
  renameDepartmentAction,
} from "./actions";

export function DepartmentsPanel({
  departments,
}: {
  departments: { id: string; name: string; userCount: number }[];
}) {
  const router = useRouter();
  const [newName, setNewName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
      } else {
        setNewName("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid max-w-md gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createDepartmentAction({ name: newName }));
        }}
      >
        <label htmlFor="new-dept" className="sr-only">New department name</label>
        <Input
          id="new-dept"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New department name"
        />
        <Button type="submit" disabled={pending || newName.trim().length === 0}>
          Add
        </Button>
      </form>

      {departments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No departments yet — add your first one above.
        </p>
      ) : (
        <ul className="grid gap-2">
          {departments.map((d) => (
            <DeptRow key={d.id} dept={d} run={run} pending={pending} />
          ))}
        </ul>
      )}

      {error ? (
        <p role="alert" className="text-destructive text-sm">{error}</p>
      ) : null}
    </div>
  );
}

function DeptRow({
  dept,
  run,
  pending,
}: {
  dept: { id: string; name: string; userCount: number };
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  pending: boolean;
}) {
  const [name, setName] = React.useState(dept.name);
  const dirty = name.trim() !== dept.name;

  return (
    <li className="flex items-center gap-2 rounded-lg border p-2">
      <label htmlFor={`dept-${dept.id}`} className="sr-only">
        Department name
      </label>
      <Input
        id={`dept-${dept.id}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8"
      />
      <span className="text-muted-foreground whitespace-nowrap text-xs">
        {dept.userCount} user{dept.userCount === 1 ? "" : "s"}
      </span>
      {dirty ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => renameDepartmentAction({ id: dept.id, name }))}
        >
          Save
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        disabled={pending || dept.userCount > 0}
        title={dept.userCount > 0 ? "Move its users first" : undefined}
        onClick={() => run(() => deleteDepartmentAction({ id: dept.id }))}
      >
        Delete
      </Button>
    </li>
  );
}
