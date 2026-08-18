---
name: ui-screen
description: UI conventions for building screens in the expense app — shadcn/ui + Tailwind, server-first components, required states, role-aware navigation. Use for any new page or significant component.
---

# UI Screen

## Structure
- Route in `app/(app)/<feature>/page.tsx` — server component; fetch via `scopedDb` with session orgId.
- Interactive pieces are leaf client components in `<feature>/components/`.
- Forms: react-hook-form + shared Zod schema + shadcn Form components; submit via server action; pending state on buttons.

## Every screen must have
- Loading state (`loading.tsx` or Suspense skeleton)
- Empty state with a clear CTA ("No expenses yet — Add your first expense")
- Error state (`error.tsx` + inline action errors from `{ok, error}`)
- Mobile layout — capture flows (expense form, receipt upload) are designed mobile-first; tables collapse to cards under `md`

## Conventions
- shadcn/ui components only; no ad-hoc CSS files; Tailwind utilities + `cn()`
- Money display via `lib/money.ts` formatter (org currency); dates via a single `formatDate` util
- Status badges: Draft=gray, Submitted=blue, Approved=green, Rejected=red, SentBack=amber, Reimbursed=violet — one shared `<StatusBadge>` 
- Policy flags: amber warning chips with tooltip text from `lib/errors.ts`; never block submission visually
- Navigation is role-aware (from session role) — but remember UI hiding is not authorization; server guards still required
- Tables: TanStack Table via shadcn DataTable; server-side pagination past 50 rows; filters mirror dashboard filters (date range, category, status, department)
- Accessibility: labels on all inputs, keyboard-navigable dialogs, aria on status colors

## Done when
Screen works for both seed orgs, all four roles see the correct variant, and the three states (loading/empty/error) are demonstrable.
