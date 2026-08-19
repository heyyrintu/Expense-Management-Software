---
name: design-craft
description: UI craft standards for this app — token-only styling, Apple-style restraint, and Emil Kowalski's motion rules. Invoke for any visual, layout, animation, or component-styling work (all D0–D5 tasks in DESIGN-PLAN.md).
---

# Design Craft

Authority: `DESIGN-PRD.md`. This skill is the working checklist.

## Before writing any style

1. Read the relevant DESIGN-PRD section (§5 tokens, §6 components, §7 screen specs).
2. Check `/design-system` — the component or pattern may already exist. Reuse over rebuild.
3. Confirm the change is presentation-only. Business logic, guards, state machines, and queries are out of scope for design tasks.

## Styling rules

- **Tokens only.** No raw hex, no `text-[13px]`, no `mt-[7px]`. If a value is missing from the token set, add it to the token layer with a comment — don't inline it.
- **One primary action per screen.** Exactly one filled indigo button in view.
- **Whitespace before dividers.** Reach for spacing to separate; add a border only when space fails.
- **The number is the hero.** Amounts get the strongest weight in any row or card; labels stay secondary and never bold.
- **Border or shadow, not both.** Cards rest flat with a hairline border; elevation is for things that float.
- **Status comes from the map.** Only `StatusBadge` defines status color (DESIGN-PRD §5.2). Never hand-color a status anywhere else.
- **Amounts:** tabular figures, right-aligned in tables, via `<Amount>`. Dates via `<DateCell>`. No ad-hoc formatting in components.

## Motion rules (Emil Kowalski — project law)

- Enter = `ease-out`; exit = `ease-in`. Never `ease-in-out` for UI.
- 150–250ms typical; 300ms is the hard ceiling.
- Animate `transform` and `opacity` only — never `width`, `height`, `top`, `left`, or `margin`.
- Every animation is **interruptible**; double-clicking never strands the UI.
- Anchor to origin: dropdowns scale from their trigger, sheets slide from their edge.
- Springs for draggable/physical things (sheets, toasts); duration easing for everything else.
- `prefers-reduced-motion`: kill transforms and springs, keep opacity fades.
- If an animation doesn't communicate state, direction, or origin — delete it.

## Every component needs

- [ ] All states: default, hover, active, focus-visible, disabled, loading
- [ ] Loading state that preserves dimensions (no layout shift)
- [ ] Keyboard operability + visible focus ring (2px accent, 2px offset)
- [ ] Touch target ≥44×44px
- [ ] Correct ARIA (role, label, `aria-live` for async feedback)
- [ ] Responsive behavior defined down to 360px
- [ ] Added/updated in `/design-system` **in the same commit**

## Every screen needs

- [ ] Empty state: icon mark, headline, one line, one action — calm, no apologies
- [ ] Loading skeleton matching the final layout's dimensions
- [ ] Error state with a recovery action
- [ ] Mobile layout verified at 360px (tables collapse to cards)
- [ ] Exactly one primary action visible

## Copy voice

Direct and plain. No exclamation marks, no apologies, no blame. "Couldn't read this receipt — enter the details yourself," not "Oops! Something went wrong!"

## Done when

`npm run lint` (including the raw-hex rule) and `npm run build` pass, tests and isolation suite stay green, the gallery is updated, and the screen matches its DESIGN-PRD §7 spec — or the deviation is documented.
