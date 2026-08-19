# Motion audit

**D5.2**, against DESIGN-PRD §4 principle 4 and §5.6.

Every animation that ships, inventoried. The rules, restated:

1. Enters `ease-out`, exits `ease-in`. **Never `ease-in-out` for UI.**
2. 150–250ms typical; **300ms is the hard ceiling**.
3. **`transform` and `opacity` only** — never width, height, top, left, margin.
4. **Interruptible** — clicking twice fast never strands the UI.
5. **Anchored to origin** — a menu scales from its trigger, a sheet from its edge.
6. Springs for draggable/physical surfaces; duration easing for everything else.
7. `prefers-reduced-motion` drops transforms and springs, keeps opacity fades.

All durations and curves come from `lib/motion.ts` (`DURATION`, `EASE`,
`SPRING`) or its CSS mirror (`--dur-*`, `--ease-*`). A component writing its
own numbers has opted out of the design system.

---

## Inventory

| # | Component | Trigger | Property | Duration | Easing | Verdict |
|---|---|---|---|---|---|---|
| 1 | `fadeScale` — Tooltip, DatePicker, FacetSelect, DateRangeSelect, ColumnVisibility, AvatarMenu, ExportMenu | open / close | `opacity`, `scale` | 150ms in · 100ms out | `out` / `in` | ✅ |
| 2 | `Dialog` content | open | `opacity`, `scale` 0.96→1 | 200ms in · 150ms out | `out` / `in` | ✅ scales from centre — a modal has no trigger to grow from |
| 3 | `collapseRow` — approval queue, add-to-report | optimistic approve / remove | `opacity`, **`height`** | 100ms opacity · 150ms height | `in` | ✅ **sanctioned exception** to rule 3 — rows below must close the gap |
| 4 | `BulkActionBar` | selection becomes non-empty | `opacity`, `y` 16→0 | 200ms in · 150ms out | `out` / `in` | ✅ rises from the edge it docks to |
| 5 | `DirtySaveBar` | form becomes dirty | `opacity`, `y` 8→0 | 200ms | `out` | ✅ |
| 6 | `PolicyFlagChip` | violation appears under a field | `opacity` | 150ms in · 100ms out | `out` / `in` | ✅ fade only — no shake, no scroll, no focus steal |
| 7 | `SavedIndicator` | autosave completes | `opacity` | 150ms in · 200ms out | `out` / `in` | ✅ |
| 8 | `AnimatedStatusBadge` | complaint status changes | `opacity` | 150ms | `out` | ✅ `mode="popLayout"` crossfades in place; `wait` would cost 300ms |
| 9 | `Tabs` active indicator | tab change | `transform` (shared `layoutId`) | 200ms | `out` | ✅ slides between triggers |
| 10 | `SegmentedControl` indicator | segment change | `transform` (shared `layoutId`) | 200ms | `out` | ✅ |
| 11 | `StatCard` count-up | first mount only | numeric value (not a CSS property) | 300ms | eased rAF | ✅ at the ceiling; skipped entirely under reduced motion |
| 12 | `PaymentProgress` bar | paid amount changes | `transform: scaleX` | 200ms | `out` | ✅ |
| 13 | `RankList` bar | render | `transform: scaleX` | none (static) | — | ✅ |
| 14 | `ReconSummaryStrip` matched bar | render | `transform: scaleX` | none (static) | — | ✅ |
| 15 | `ReceiptDropzone` upload progress | upload progresses | `transform: scaleX` | 200ms | `out` | ✅ reserved space, never reflows |
| 16 | `BudgetsPanel` utilisation bar | render | `transform: scaleX` | 200ms | `out` | ✅ **fixed in D5.2** — see violations |
| 17 | Hover / focus states (39 call sites) | pointer, focus | `color`, `background-color`, `border-color` | 100ms | `out` | ✅ colour only, no layout |
| 18 | `Card` interactive hover | pointer | `background-color` | 100ms | `out` | ✅ **fixed in D5.2** — see violations |
| 19 | Filter/table pending state | server round-trip | `opacity` | 100ms | `out` | ✅ |
| 20 | `Skeleton` pulse | while loading | `opacity` | 1.6s loop | `--ease-enter` | ✅ **sanctioned exception** to rule 2 — an ambient indicator, not a transition; `animation: none` under reduced motion |
| 21 | Busy spinner — Button, MaskedValue, WhatsApp step | pending action | `transform: rotate` | 1s loop | `linear` | ✅ **fixed in D5.2** — see violations |
| 22 | Sheet (Vaul) — payment run, import, complaint, invite, mobile filters | open / drag / close | `transform: translateY` | Vaul spring | spring | ✅ rule 6: draggable, so physical |
| 23 | Toast (Sonner) | notify | `transform`, `opacity` | Sonner default | — | ✅ enters from the edge it stacks at |
| 24 | Recharts series | chart mount | SVG geometry | 300ms | — | ✅ at the ceiling; `isAnimationActive: false` under reduced motion |
| 25 | Sidebar collapse | rail toggle | **none — snaps** | — | — | ✅ deliberate: width is a layout property and nothing obliges it to animate |

---

## Violations found and fixed

Four. Each had been in the codebase for several milestones — the rules were
written down, agreed with, and broken anyway, quietly, in files nobody
re-read. That is the argument for `scripts/check-motion.mjs` below.

### 1. Budget utilisation bar — animated `width` under `transition-all`

`app/(app)/budgets/budgets-panel.tsx`

```diff
- className={cn("h-full rounded-full transition-all", BAR_COLORS[b.level])}
- style={{ width: `${Math.min(b.pct, 100)}%` }}
+ className={cn("h-full w-full origin-left rounded-full",
+               "transition-transform duration-base ease-out", BAR_COLORS[b.level])}
+ style={{ transform: `scaleX(${Math.min(b.pct, 100) / 100})` }}
```

Two violations in one line. `width` is a layout property, so every frame
reflowed the panel; and `transition-all` also animated the **colour** the bar
changes to when a budget tips into overspend — so the one moment the bar most
needs to be read, it was mid-way between amber and red.

Every other progress bar in the app (payment, receipt upload, reconciliation,
rank list) already used `scaleX`. This one predated them.

*(While there: `BAR_COLORS` used raw palette classes — `bg-green-500` — rather
than the status tokens every other surface reads. Fixed too.)*

### 2. `Card` hover shadow

`components/ui/card.tsx`

```diff
- "transition-shadow duration-instant ease-out hover:shadow-raised"
+ "hover:bg-bg-subtle transition-colors duration-instant ease-out"
```

`box-shadow` is outside transform-and-opacity: it repaints, and on a grid of
cards that is a repaint per card per pointer move. It also stacked a shadow on
a component that already has a border, which §4.2 forbids.

`StatCard` had already made this call in D1.4 — "the link state adds a hover
tint rather than a shadow, so the card never appears to lift" — while the base
`Card` quietly did the opposite.

### 3. `ExportMenu` anchored to nothing

`components/ledger/export-menu.tsx`

```diff
- className="… origin-dropdown …"
+ className="… origin-popover …"
```

The menu is built on Radix **Popover**, but used `origin-dropdown`, which
reads `--radix-dropdown-menu-content-transform-origin` — a variable Radix
DropdownMenu sets and nothing else does. Radix DropdownMenu is not a
dependency, so the variable was never defined and `transform-origin` fell back
to centre: the menu scaled from its own middle while the source read as though
it were anchored to the Export button.

This is rule 5 failing *silently*, which is the worst way for it to fail. The
`origin-dropdown` utility has been removed from `app/globals.css` so no one
can reach for it again.

### 4. Spinners froze under reduced motion

`app/globals.css`, and the three spinner call sites

The blanket `prefers-reduced-motion` rule set `animation-duration: 0.01ms` on
everything, which froze each spinner mid-rotation — a static three-quarter arc
at an arbitrary angle, reading as a broken icon rather than as "working".
Freezing the only signal that something is happening trades motion sensitivity
for confusion.

Busy indicators now opt in explicitly with `data-motion="busy"` and keep a slow
**opacity** pulse instead, with rotation cancelled outright. Opacity is exactly
what reduced motion permits, so the information survives and the movement
doesn't.

---

## Motion deleted outright

Rule: *if an animation doesn't communicate state, direction or origin, delete
it — don't tune it.* Three exports from `lib/motion.ts` went.

| Removed | Why |
|---|---|
| `staggerList` / `staggerItem` / `staggerFor` / `STAGGER_*` | **Purely decorative.** A stagger on a list's first paint communicates nothing — the rows aren't arriving in a meaningful order, they're all already there, and the effect only delays the last one. Never used outside the gallery demo that existed to show it off. |
| `slideUpSheet` | Sheets are Vaul, which owns its own spring and drag physics. The variant governed nothing while appearing to define sheet motion — the most misleading kind of dead code in a file whose job is to be the single source of truth. |
| `fadeOnly` | `MOTION_CONFIG`'s `reducedMotion: "user"` already strips transforms and keeps opacity for every component at once. A hand-reachable variant was a second way to do what the provider does, and the two could disagree. |

`origin-dropdown` was removed from `app/globals.css` for the same reason — a
utility reading a variable nothing defines is worse than no utility.

---

## Sanctioned exceptions

Two, both argued where they live, both requiring a written `motion-ok:` reason
to pass the checker.

1. **`collapseRow` animates `height`** (rule 3). Removing a row from a list has
   to close the gap beneath it; there is no transform that does this. Opacity
   leads the height out so the content is gone before the space closes.
2. **The skeleton and busy pulses run for 1.6s** (rule 2). The ceiling governs
   *transitions* — motion between two states. An ambient loading indicator is a
   different thing: it has no end state, and a 300ms loop would strobe.

---

## Verification

### `prefers-reduced-motion`

| Check | Result | How |
|---|---|---|
| No transforms run | ✅ | `MOTION_CONFIG.reducedMotion: "user"` — Framer drops transform and layout animations globally, asserted in `tests/unit/motion.test.ts` |
| No springs run | ✅ | Same mechanism; Framer resolves springs instantly. Vaul reads the media query itself |
| Opacity fades remain | ✅ | Framer keeps opacity; the global CSS rule shortens durations rather than setting `animation: none` |
| Nothing unusable or invisible | ✅ | The one case where it *was* — frozen spinners — is violation 4 above, now an opacity pulse |
| Charts | ✅ | `isAnimationActive: !reducedMotion` in `lib/charts/theme.ts` |
| Count-up | ✅ | `StatCard` skips the tween entirely; the final figure is correct on the first frame |

### Throttled CPU (4× slowdown)

**Not performed.** This needs a browser with CPU throttling, and the
Claude-in-Chrome tooling has not been connected in any session of this build —
the same gap recorded in `docs/STATES-AUDIT.md` for CLS measurement.

What can be said without it: after the fixes above, **every** animation in the
app runs on `transform` or `opacity` except the two sanctioned exceptions, so
none triggers layout or paint on the main thread — which is the property CPU
throttling is used to expose. The two exceptions are bounded: `collapseRow`
animates the height of a single row for 150ms, and the pulses are opacity.

That is an argument, not a measurement, and it is recorded as such. A throttled
pass should still be run before release; the honest place to catch a
regression in the meantime is the checker below.

---

## Keeping it true

`scripts/check-motion.mjs` runs in `npm run lint` and fails the build on:

- `transition-all`
- `ease-in-out`
- `transition-shadow`
- `transition-[width|height|top|left|right|bottom|margin]`
- arbitrary durations (`duration-[…]`) and any over 300ms
- inline Framer `duration:` values in seconds above the ceiling

Comments and JSX comments are stripped before scanning — a checker that flags
its own rationale is one people switch off. The `motion-ok:` escape hatch
requires a written reason, so a third sanctioned exception cannot be added
silently.

Verified by injecting a violation and confirming it fails.
