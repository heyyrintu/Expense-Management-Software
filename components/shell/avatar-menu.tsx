"use client";

// Avatar menu (D0.4): profile · org · sign out.
//
// Built on Radix Popover rather than a bespoke dropdown so the focus trap,
// Esc-to-close, outside-click and return-focus behaviour come for free. It
// scales from its trigger via `origin-popover` — §4.4's "elements animate
// from their origin".
import * as React from "react";
import Link from "next/link";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { motion } from "framer-motion";
import { Building2, LogOut, User } from "lucide-react";

import { fadeScale } from "@/lib/motion";
import { roleAtLeast, type Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

export function AvatarMenu({
  name,
  email,
  role,
  orgName,
  signOutAction,
}: {
  name: string;
  email: string;
  role: Role;
  orgName: string;
  /** The real server action, passed down from the layout. */
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const canSeeOrgSettings = roleAtLeast(role, "finance_admin");

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        aria-label={`Account menu for ${name}`}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full",
          "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
        )}
      >
        <Avatar name={name} />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={6} asChild>
          <motion.div
            variants={fadeScale}
            initial="hidden"
            animate="visible"
            className="border-line bg-bg-surface shadow-overlay origin-popover z-50 w-64 rounded-md border p-1"
          >
            {/* Identity block: who you are and which tenant you're in. The
                org name matters in a multi-tenant product — it is the answer
                to "am I about to do this in the wrong company". */}
            <div className="grid gap-1 px-3 py-2">
              <p className="text-label text-text-primary truncate">{name}</p>
              <p className="text-meta text-text-tertiary truncate">{email}</p>
              <p className="text-meta text-text-secondary truncate">
                {orgName} · {role.replace("_", " ")}
              </p>
            </div>
            <div className="bg-line my-1 h-px" role="none" />

            <MenuLink href="/profile" icon={<User aria-hidden="true" className="size-4" />} onNavigate={() => setOpen(false)}>
              Profile
            </MenuLink>
            {canSeeOrgSettings ? (
              <MenuLink
                href="/settings/organization"
                icon={<Building2 aria-hidden="true" className="size-4" />}
                onNavigate={() => setOpen(false)}
              >
                Organization
              </MenuLink>
            ) : null}

            <div className="bg-line my-1 h-px" role="none" />
            <form action={signOutAction}>
              <button
                type="submit"
                className={cn(
                  "text-text-secondary hover:bg-bg-subtle hover:text-text-primary flex h-11 w-full items-center gap-3 rounded-md px-3 text-label",
                  "transition-colors duration-instant ease-out",
                  "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
                )}
              >
                <LogOut aria-hidden="true" className="size-4" />
                Sign out
              </button>
            </form>
          </motion.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "text-text-secondary hover:bg-bg-subtle hover:text-text-primary flex h-11 items-center gap-3 rounded-md px-3 text-label",
        "transition-colors duration-instant ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

/** Initials on accent-subtle. No image upload exists yet; when it does this
 *  is where it goes, with initials as the fallback. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-accent-subtle text-accent-text grid size-8 place-items-center rounded-full text-label",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
