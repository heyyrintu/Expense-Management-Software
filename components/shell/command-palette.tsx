"use client";

// Command palette (D0.4 trigger + navigation; §6.1).
//
// SCOPE: navigation and quick actions only. §6.1 also lists expense search
// here — that arrives with the D1.3 filter bar, which is what gives the
// expense list a query surface to search against. Inventing one now would
// mean inventing an API for it, and design tasks don't change queries.
//
// Everything it can reach is role-filtered through the same visibleSections()
// the sidebar uses, so the palette can never surface a destination the
// sidebar hides. The route's own server guard still runs on arrival.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { ADD_EXPENSE_HREF, visibleItems, type NavItem } from "./nav";

type Command = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ReactNode;
};

export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const commands = React.useMemo<Command[]>(() => {
    const actions: Command[] = [
      {
        id: "action:new-expense",
        label: "New expense",
        hint: "Action",
        href: ADD_EXPENSE_HREF,
        icon: <Plus aria-hidden="true" className="size-4" />,
      },
    ];
    const destinations = visibleItems(role).map((item: NavItem) => ({
      id: `nav:${item.href}`,
      label: item.label,
      hint: "Go to",
      href: item.href,
      icon: <item.icon aria-hidden="true" className="size-4" />,
    }));
    return [...actions, ...destinations];
  }, [role]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // ⌘K / Ctrl+K anywhere. Toggling (not just opening) means a second press
  // closes it — pressing the shortcut twice never strands an open overlay.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function run(command: Command | undefined) {
    if (!command) return;
    setOpen(false);
    router.push(command.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[activeIndex]);
    }
  }

  return (
    <>
      <SearchTrigger onClick={() => setOpen(true)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="gap-0 p-0">
          <DialogTitle className="sr-only">Search and commands</DialogTitle>

          {/* The ring lives on the CONTAINER, not the input (D-6). The input
              is a bare `outline-none` field inside a bordered row, so focus
              had nothing to show at all — masked by autoFocus on open, and
              plainly missing the moment anyone Shift+Tabbed back to it.
              Same focus-within pattern as AmountInput in components/ui/
              input.tsx; `ring-inset` rather than an offset ring because this
              row sits flush against the dialog's rounded top edge, where an
              outward ring would be clipped by the overflow. */}
          <div
            className={cn(
              "border-line flex items-center gap-3 border-b px-4",
              "focus-within:ring-2 focus-within:ring-focus-ring focus-within:ring-inset",
              "transition-[box-shadow] duration-instant ease-out"
            )}
          >
            <Search aria-hidden="true" className="text-text-tertiary size-4 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages and actions"
              aria-label="Search pages and actions"
              aria-controls="command-results"
              aria-activedescendant={results[activeIndex] ? `command-${results[activeIndex].id}` : undefined}
              className="text-body text-text-primary placeholder:text-text-tertiary h-12 w-full bg-transparent outline-none"
            />
          </div>

          <ul id="command-results" role="listbox" aria-label="Results" className="max-h-64 overflow-y-auto p-2">
            {results.length === 0 ? (
              <li className="text-body text-text-secondary px-3 py-6 text-center">
                Nothing matches “{query}”.
              </li>
            ) : (
              results.map((command, index) => (
                <li key={command.id}>
                  <button
                    id={`command-${command.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => run(command)}
                    className={cn(
                      "flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-label",
                      "transition-colors duration-instant ease-out",
                      "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
                      index === activeIndex
                        ? "bg-accent-subtle text-accent-text"
                        : "text-text-secondary"
                    )}
                  >
                    {command.icon}
                    <span className="flex-1 truncate">{command.label}</span>
                    {command.hint ? (
                      <span className="text-meta text-text-tertiary">{command.hint}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * The trigger. An icon button up to lg, the full bordered field above it.
 *
 * The breakpoint is lg, not md, on purpose: at 768–1023px the sidebar is
 * already taking 240px and the delegation switcher may be in the bar too, so
 * a 224px search field would squeeze the page title down to nothing. The
 * shortcut still works at every width — only the affordance shrinks.
 */
function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search pages and actions"
      className={cn(
        "text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle flex items-center gap-2 rounded-md",
        "transition-colors duration-instant ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface",
        // Icon-only under lg, a bordered search field from lg up.
        "size-11 justify-center",
        "lg:border-line lg:bg-bg-app lg:h-9 lg:w-56 lg:justify-start lg:border lg:px-3"
      )}
    >
      <Search aria-hidden="true" className="size-4 shrink-0" />
      <span className="text-label hidden flex-1 text-left lg:block">Search</span>
      <kbd className="text-meta text-text-tertiary border-line bg-bg-surface hidden rounded-sm border px-1 lg:block">
        ⌘K
      </kbd>
    </button>
  );
}
