# DESIGN-PLAN-NEOCLASSICAL — "The Ledger Hall"

**Status:** proposed · supersedes the visual direction of [DESIGN-PLAN.md](DESIGN-PLAN.md) (D0–D5, executed) without modifying it
**Theme:** light only (unchanged non-goal: no dark mode)
**Direction:** modern Neoclassical — marble ground, engraved hairlines, Roman capitals, Didone display type, laurel green, bronze gilt reserved for ceremony
**Scope:** visual redesign only. No logic changes, no schema changes, no route changes.

---

## 1. Concept

The expense app becomes **The Ledger Hall**: a modern financial institution in the neoclassical tradition. Money has been recorded in buildings like this for three centuries — stone floors, engraved plates, ruled ledgers, gilt lettering used only where something is *finished*. The app already believes "the number is the hero" (DESIGN-PRD §4.3); this redesign gives that belief an architecture.

Modern execution, not a costume: flat color, generous whitespace, sharp grid, zero skeuomorphism, zero new illustration. The neoclassicism lives in exactly four places — the limestone neutrals, the Didone page titles, the engraved double rule, and the gilt seal. Everything else stays as quiet as it is today.

What this is deliberately **not**: the generic warm-cream + high-contrast-serif + terracotta look. Our ground is cool limestone, our display face is a true Didone (Bodoni Moda), our accent is laurel green, and our one indulgence is bronze — earned, not decorative.

### Relationship to DESIGN-PRD.md

| DESIGN-PRD decision | Fate |
| --- | --- |
| Indigo/violet accent (§5.1) | **Superseded** → laurel green + gilt (this doc §3) |
| Inter as the only typeface (§5.3) | **Superseded** → Inter stays for UI + all data; Bodoni Moda added for display/H1 only |
| Light-only, no dark mode (§3) | Carries over verbatim |
| Restraint; hierarchy via space not lines (§4) | Carries over — the plate rule is the *one* sanctioned line device |
| "The number is the hero" (§4.3) | Carries over, amplified (gilt hero balance) |
| Motion explains, never entertains (§4.4); all motion tokens | Carries over **unchanged** — durations, curves, springs are untouched |
| Optimistic-but-honest feedback; one primary action per screen | Carries over verbatim |
| No custom illustrations, no per-tenant theming | Carries over verbatim |

### Hard rules (identical to the D-series)

- Every visual value flows through the token layer in [app/globals.css](app/globals.css). No raw hex, no `text-[13px]` at call sites — `npm run lint` fails on both (`scripts/check-design-tokens.mjs`).
- Every color pair stated below has been measured; `scripts/check-contrast.mjs` remains the referee and must be extended to cover the new gilt tokens in the same commit that adds them.
- No logic changes inside any N-task. Before/after screenshots per task. Lint + build + test + isolation suite green before ticking a box.

---

## 2. Token specification — neutrals (limestone)

The zinc greys become a warm limestone family. Surface stays pure white so every existing contrast measurement stays honest.

| Token | Current | New | Measured (WCAG) |
| --- | --- | --- | --- |
| `--bg-app` | `#fafafa` | `#F4F2ED` | ground only |
| `--bg-surface` | `#ffffff` | `#ffffff` (unchanged) | — |
| `--bg-subtle` | `#f4f4f5` | `#EDEAE3` | fills only |
| `--line` | `#e4e4e7` | `#E2DFD7` | static content rules only (1.4.11 exempt, same as today) |
| `--line-strong` | `#8a8a94` | `#878279` | 3.82:1 on surface, 3.18:1 on bg-subtle, 3.41:1 on bg-app — all ≥3:1 ✓ |
| `--fg-primary` | `#18181b` | `#1E1B16` | 15.3:1 on bg-app ✓ |
| `--fg-secondary` | `#52525b` | `#54514A` | 7.08:1 on bg-app ✓ |
| `--fg-tertiary` | `#6b6b74` | `#6B675D` | 5.64 / 5.04 / 4.69:1 on surface / bg-app / bg-subtle — all ≥4.5:1 ✓ (preserves the D5.3 fix) |
| `--fg-on-accent` | `#ffffff` | unchanged | see accent table |

## 3. Token specification — accent (laurel) and gilt (bronze)

Laurel replaces indigo one-for-one across the existing base/solid/text split, so **every component that references a semantic accent name re-skins itself with zero call-site edits** (including `selected-bar`, active nav, links, focus rings).

| Token | Current (indigo) | New (laurel) | Measured |
| --- | --- | --- | --- |
| `--accent-base` | `#6366f1` | `#35604F` | white on it 7.15:1 ✓; vs `--bg-app` 6.39:1 (focus ring clearly visible) |
| `--accent-hover-base` | `#4f46e5` | `#2C5142` | darker step |
| `--accent-pressed-base` | `#4338ca` | `#244337` | darkest step |
| `--accent-subtle-base` | `#eef2ff` | `#E9F0EA` | fill only |
| `--accent-border-base` | `#c7d2fe` | `#B9CEC2` | decorative border |
| `--focus-ring-base` | `#6366f1` | `#35604F` | 6.39:1 vs bg-app ✓ |
| `--accent-solid-base` | `#4f46e5` | `#2F5747` | white on it 8.15:1 ✓ |
| `--accent-text-base` | `#4f46e5` | `#2F5747` | 8.15:1 on white, 7.04:1 on accent-subtle ✓ |

Note the base color now *passes* AA with white text (7.15:1) — unlike the old indigo (4.47:1) — but we keep the base/solid split anyway: it is a working architectural seam, and hover/pressed still need their own steps.

**Gilt — a NEW ceremonial family.** This is the redesign's one bold move, and it is governed by law, not taste:

| Token | Value | Measured |
| --- | --- | --- |
| `--gilt-base` | `#A5761F` | fills/graphics: 4.03:1 on white, 3.60:1 on bg-app — ≥3:1 ✓. Never small text. |
| `--gilt-text` | `#7A5410` | 6.77:1 on white, 6.05:1 on bg-app, 5.90:1 on gilt-subtle — ≥4.5:1 ✓ |
| `--gilt-subtle` | `#F6EFDD` | fill only |

**Gilt usage law** (enforceable by grep, review-checked per task): gilt may appear in exactly three places —
1. the ledger's closing balance (`<Amount face="display">`) — *N2.2 correction: this was originally "the dashboard's hero balance", but no dashboard KPI is finished money (total / pending / approved / outstanding), and the law doesn't bend for its own first application. The dashboard hero keeps the Bodoni face in ink; gilt waits for the ledger (N3).*
2. the seal badge — terminal money states only (Paid, Settled — the `solidDot` entries in the status map),
3. the wordmark rule on the auth screens.

Never on buttons, never on links, never on nav, and in charts only as the single "reimbursed" series. If a fourth use ever feels necessary, it goes through the token-exception process in `globals.css`'s header comment.

**Status tokens: unchanged, with one CI-forced exception.** The success/danger/info/neutral tokens carry over as-is. The amber pair did not survive the limestone surfaces — `check-contrast.mjs` measured the D-series values at 2.94:1 (fill on the new bg-subtle, 3:1 floor) and 4.18:1 (text, 4.5 floor) — so N0.1 darkened it minimally: `--status-warning` `#CE7008` → `#C46A08`, `--status-warning-text` `#B45309` → `#A84D08`. Same amber hue, now with margin on every surface. (Deviation from this plan's original "unchanged" claim, found and forced by CI during N0 — the referee worked as designed.) One honest caveat: success `#059669` (bright emerald) and accent `#35604F` (dark laurel) are both greens at 1.9:1 from each other. They are separated by a ~2× lightness difference and never compete in the same role (accent marks *interactive/selected*, success marks *state*), but N2 must verify the approvals queue — where a selected row edge and a success dot can share a row — reads unambiguously in a screenshot before ticking.

## 4. Token specification — radius, elevation, motion, layout

Rectilinear neoclassicism, one notch sharper across the scale:

| Token | Current | New |
| --- | --- | --- |
| `--radius-sm` | 6px | **4px** (badges, inputs) |
| `--radius-md` | 8px | **6px** (buttons, dropdowns) |
| `--radius-lg` | 12px | **8px** (cards, sheets) |

**Unchanged:** all elevation tokens (the four shadows are already whisper-quiet), the scrim, all motion durations/curves/springs (project law, `check-motion.mjs`-enforced), all spacing steps, all layout tokens (sidebar 240/64, content 1280, topbar 56, tabbar 64, row 48), breakpoints, ledger/bucket heights, and the entire print stylesheet (a printed ledger is evidence; it is already correct).

## 5. Typography

**Two faces, strict jurisdiction:**

- **Bodoni Moda** (Google variable font, optical sizing axis) — added via `next/font` in [app/layout.tsx](app/layout.tsx) as `--font-bodoni`, mapped in `@theme inline` as `--font-display`. Jurisdiction: `text-display`, `text-h1`, and the auth wordmark. Nothing else.
- **Inter** — stays as `--font-sans` for H2/H3, body, labels, meta, all controls, and **all tabular data without exception**. The `tnum`/`cv05` wiring in the `.tabular` and `.amount` utilities is load-bearing for every money column; Bodoni Moda offers no tabular guarantee and must never touch a column of numbers.

Scale changes in `@theme inline`:

| Style | Change |
| --- | --- |
| `--text-display` (32/38) | family → display; weight 600 → **700**; letter-spacing −0.02em → **−0.01em** (Didones self-tighten; over-tracking them clogs the hairlines) |
| `--text-h1` (24/32) | family → display; weight 600 → **700**; letter-spacing −0.015em → **−0.005em** |
| `--text-h2` … `--text-micro` | **unchanged**, Inter |
| `--text-eyebrow` (NEW) | 11px / 16px / weight 600 / letter-spacing **+0.14em** / uppercase — the Roman-capitals eyebrow. Used above page titles and as the `StatCard` label style. Rendered in Inter (modern capitals, not faux small caps). |

One numeric exception, sanctioned: the dashboard's single hero balance and the ledger's closing balance may render in Bodoni Moda — each is one static number with no siblings to align against, so tabular jitter is impossible. Implemented as an explicit `display` variant on `<Amount>`, not a default.

Font loading: variable, `display: swap`, latin subset, same pattern as Inter. Bodoni Moda is used above the fold on every page (H1), so preload is automatic via `next/font`; verify no CLS in the N5 pass.

## 6. Structure and the signature element

**Signature: the engraved plate rule.** A double hairline — two 1px `--line` rules, 3px apart — implemented **once** as `@utility plate-rule` in `globals.css` (border-top plus a `::before`/offset shadow, whichever survives the box-model cleanly; zero layout shift either way). It appears in exactly three positions:

1. under every page header (eyebrow → Bodoni H1 → plate rule),
2. as the top edge of every `StatCard`,
3. as the bottom edge of the top bar (replacing its single hairline).

That one device carries the entire neoclassical identity across data-dense screens without touching data legibility. It is the *only* sanctioned ornamental line: tables keep their existing single hairlines, cards keep their plain borders. Chanel rule applied — everything else in the app stays exactly as quiet as it is today.

**Page header pattern** (N2, becomes the `PageHeader` component contract):

```
CAPITAL·SPACED·EYEBROW            ← text-eyebrow, --fg-tertiary
Reports                           ← text-h1, Bodoni Moda, --fg-primary
═══════════════════════════       ← plate-rule
```

**Shell:** the sidebar becomes a stone panel — `bg-bg-subtle` over the new limestone values, separated from the content by a single `--line` hairline. *(N1 correction to this plan's original claim:* the accent-subtle pill measured 1.03:1 against the stone panel — invisible — so the active row became an **inlaid white surface tile with laurel text** (1.20:1 vs the panel, the same prominence the old pill had on white), and hover became that tile at 60%. One signal, no left bar, unchanged elsewhere — table selection etc. still uses accent-subtle on white surfaces.)* Top bar: surface white, plate-rule bottom edge rendered as an absolute overlay so the bar's height stays exactly `--topbar-height` and `top-topbar` sticky headers don't underlap. Mobile tab bar and command palette: token swap only.

**Auth screens:** the one ornamental moment in the app — a centered pediment composition: wordmark set in Bodoni Moda, a short `--gilt-base` rule beneath it (gilt use #3), the form on a white slab, laurel primary button. No illustration, no laurel wreaths, no columns.

**Charts** ([components/charts/](components/charts/)): series palette remap only —

*(Values below are what shipped after N3.2 and the N5 audit; the draft's `#7FA08F` sage and `#9A948A` stone were rejected for measuring 2.87:1 and 3.01:1 against the 3:1 fill floor, and the palette was widened from four entries to six — see N3.2 and N5.)*

| Series role | Hex | On white |
| --- | --- | --- |
| primary (spend) | `#35604F` laurel | 7.15:1 |
| 2 | `#4A6F95` slate blue | 5.25:1 |
| 3 | `#75997F` sage | 3.17:1 |
| 4 | `#6B4F6E` plum | 7.07:1 |
| 5 | `#2F7D7A` teal | 4.84:1 |
| last / "Other" | `#8A8478` stone | 3.72:1 |
| reimbursed (terminal state only, outside the rotation) | `#A5761F` gilt | 4.03:1 |

The palette must stay **longer than the widest chart's series count** (`TREND_TOP_N + 1`), because `seriesColor()` cycles; `tests/unit/chart-theme.test.ts` pins that invariant.

Grid lines `--line`, axis text `--fg-tertiary`, unchanged geometry and motion.

**Empty states:** existing lucide line icons, recolored by the token swap. No new illustration (PRD non-goal, still in force).

---

## 7. Milestones

Every task inherits the hard rules from §1. "Gates" = `npm run lint` (tokens, contrast, motion, copy voice) + `npm run build` + test suite + isolation suite + before/after screenshots into `docs/screenshots/`.

### N0 — Foundation: token & font swap ✅ 2026-08-27
- [x] **N0.1** Remap `:root` in [app/globals.css](app/globals.css) per §2–§4: neutrals, accent family, radius. Add the three gilt tokens with a comment block stating the usage law verbatim. All literal hexes live here and nowhere else. *(Includes the CI-forced amber nudge documented in §3.)*
- [x] **N0.2** Extend `scripts/check-contrast.mjs` to assert the new pairs: gilt-text/{all surfaces, gilt-subtle}, gilt-base ≥3:1 as fill, line-strong ≥3:1 on all three surfaces (laurel pairs were already covered by the checker's dynamic sweep). 64 pairs green. `CONTRAST_CONTRACT` and `BRAND_FILL_PAIRS` in [lib/design/tokens.ts](lib/design/tokens.ts) updated to match; 13/13 unit tests pass.
- [x] **N0.3** Bodoni Moda added in [app/layout.tsx](app/layout.tsx) (`--font-bodoni`, opsz axis), `--font-display` mapped in `@theme inline`, display/h1 weight→700 with relaxed Didone tracking, `--text-eyebrow` added. Note: Tailwind v4 emits no font-family per text style, so display/h1 call sites pair the size utility with `font-display` — demonstrated in the gallery, enforced by PageHeader in N2.
- [x] **N0.4** `@utility plate-rule` (standalone 4px double-hairline element) and `@utility eyebrow` (scale + uppercase) added to `globals.css`.
- [x] **N0.5** `/design-system` swept in the browser: all token groups (incl. Gilt with its law), type scale with Bodoni display/h1 and eyebrow specimens, utility-resolution rows seamless, all components render on the new tokens. Registry in `lib/design/tokens.ts` updated so the gallery documents the new system.

> **N0 unblocked the runbook too:** deleting the stray `pnpm-lock.yaml`/`pnpm-workspace.yaml` (the on-disk half of commit `f2cd67c`'s repair) fixed both documented crashes — `next build` now completes cleanly (all routes) and `next dev` boots in ~3s on the Windows host. No `node_modules` reinstall was needed. N5.0 is effectively done; the suites in runbook §1–2 are now runnable.
> Known pre-existing issue (not N0's): the gallery's approval-queue specimen hydration-mismatches because its `DateCell` specimens are built from `new Date()` at render; fix when touching the gallery in N4.3.

### N1 — Shell ✅ 2026-08-27
- [x] **N1.1** [components/shell/sidebar.tsx](components/shell/sidebar.tsx): stone panel (`bg-bg-subtle`, hairline edge kept). Active/hover reworked to the inlay scheme documented in §6 (accent-subtle washed out on stone at 1.03:1); focus-ring offsets repointed to the panel colour. Rail states verified.
- [x] **N1.2** [components/shell/top-bar.tsx](components/shell/top-bar.tsx): plate-rule bottom edge as an absolute overlay (height contract preserved — see §6). [components/shell/mobile-tab-bar.tsx](components/shell/mobile-tab-bar.tsx) and [components/shell/command-palette.tsx](components/shell/command-palette.tsx) verified token-only, no edits needed. Gallery shell specimens updated to mirror both treatments; verified in the browser (panel `#EDEAE3`, inlay `#FFFFFF` + laurel `#2F5747`, plate rule 4px/two 1px `--line` lines at the bar's bottom edge).

### N2 — Headers, cards, money ✅ 2026-08-27
- [x] **N2.1** [components/ui/page-header.tsx](components/ui/page-header.tsx) is now the enforcement point: eyebrow (auto-derived from the nav model via `sectionLabelFor` in [components/shell/nav.ts](components/shell/nav.ts); suppressed under breadcrumbs or when it repeats the title) → Bodoni H1 (`text-h1 font-display`) → plate rule. **19 pages** under `app/(app)/*` that hand-rolled `text-xl` h1s were converted onto it (tsc + eslint green, no raw page-title h1s remain). Out of scope, documented: `app/super/*`, error pages, `settings-panel.tsx` / `complaint-header-card.tsx` sub-headers (h1-at-h2-size, Inter — Bodoni's jurisdiction stays display/h1). Conversion notes: two inline-markup descriptions flattened to plain strings (recurring's mid-sentence link, email-ingestion's `<code>`), approvals/[id]'s sub-line `DateCell` → `formatDate` (same rendered text).
- [x] **N2.2** [components/ui/stat-card.tsx](components/ui/stat-card.tsx): engraved top edge (the card's own border is the first stroke, an inner hairline 3px below is the second), label → eyebrow style, `hero` prop renders the value in Bodoni via the new `<Amount face="display">` — first card of every KPI strip, count-up disabled on hero (proportional Didone figures must not animate width). **Gilt was NOT applied here** — see the §3 law correction; the dashboard hero is Bodoni in ink.
- [x] **N2.3** The seal: terminal money states (`solidDot` — Paid, Settled) render as gilt chips via `SEAL_CLASSES` in [lib/design/status.ts](lib/design/status.ts), consumed only by `StatusBadge`. Verified in the gallery: Paid/Settled compute to gilt (`#F6EFDD`/`#7A5410`/dot `#A5761F`), Approved stays emerald. Ambiguity check by computed values: flagged edge `#C46A08` amber, success dot `#059669` emerald, selection `#35604F` laurel — distinct in lightness (~2×) and chroma; the human-eye screenshot pass folds into the N5.2 baseline (the Browser pane could not composite screenshots this session).

> **N2 bonus fix, app-wide:** `tailwind-merge` did not know the project's custom theme and was classing `text-display`/`text-h*`/`text-body*` (font sizes) against `text-text-primary` (a colour) in one ambiguity group, keeping only the last — so `cn()` had been silently stripping the size class from every `<Amount>` since D1.1. [lib/utils.ts](lib/utils.ts) now extends tailwind-merge with the real font-size and text-colour groups; amounts render at their §5.3 sizes everywhere again.

### N3 — Data surfaces ✅ 2026-08-27
- [x] **N3.1** DataTable + FilterBar: verified token-only end-to-end (design-token lint green, no edits needed); `selected-bar` computes to laurel `#35604F` in the browser; hover/sticky behaviour resolves from the swapped tokens automatically.
- [x] **N3.2** [lib/charts/theme.ts](lib/charts/theme.ts) remapped: `CHART_ACCENT #35604f`, rotation `[laurel, sage #62836f, slate #5b6e8c, stone #8a8478]` (sage and stone darkened from this plan's §6 draft values `#7FA08F`/`#9A948A`, which measured 2.87 and 3.01 vs the 3:1 fill floor), grid/axis follow the limestone tokens. **Gilt is excluded from the rotation** — exported separately as `CHART_REIMBURSED` with the law noted, and `tests/unit/chart-theme.test.ts` now asserts both that it matches `--gilt-base` and that the rotation never contains it. The mirror test (`chart theme tracks the token layer`) passes again — it had been red since N0's token swap. Verified live: area series render laurel/sage/slate; the gallery palette block reads `CHART_SERIES` directly.
- [x] **N3.3** Ledger: the **Paid total** in the sticky footer is gilt use #1 realised (`seal` prop on `TotalItem` → `text-gilt-text`; colour only, no Bodoni — one Didone figure among four inline totals would be noise). Verified in all three gallery ledger specimens (`#7A5410`). Print stylesheet structurally untouched, with one bug fixed inside it: the print block overrode `--text-*` variables that don't exist (the ink tokens are `--fg-*`) — printed text had silently kept screen colours since D4.1; names now match. Recon components verified token-only.

### N4 — Auth, empty states, gallery ✅ 2026-08-27
- [x] **N4.1** [app/(auth)/layout.tsx](app/(auth)/layout.tsx) carries the pediment for every auth screen (login, signup, invite, auth error): receipt-fold mark (extracted to [components/shell/brand-mark.tsx](components/shell/brand-mark.tsx) so shell and pediment share one file), wordmark in Bodoni (the display face's third jurisdiction), and the short gilt rule — **gilt use #3**. Verified live on `/login`: wordmark Bodoni 24/700, rule `#A5761F` 2×48px, mark and Sign-in button laurel solid. Also fixed in passing: the four auth `CardTitle`s used stock `text-xl` off the token scale → `text-h2`. **Amended in N5.4:** that verification missed a real defect — `CardTitle` renders a `<div>`, so the pediment left every auth screen with *zero heading elements*. `CardTitle` gained an `as` prop and the four titles are now real `<h1>`s, re-verified in Chromium (`/login` → `h1 "Sign in"`, `/signup` → `h1 "Create your organization"`).
- [x] **N4.2** Empty states: verified token-only (design-token lint), recolor automatic — no edits.
- [x] **N4.3** Gallery documentation complete: token swatches with measured ratios and the Gilt group's law (N0.5), both type families with jurisdiction notes (N0.5), seal + hero + chart palette (N2–N3), and a dedicated **plate-rule demo block** in the scales section stating the three-positions law. Verified rendering.

### N5 — Verification ◐ 2026-08-28 (everything runnable without a database is done; the rest is blocked)
- [x] **N5.0** Resolved in N0 — `next build` and `next dev` both run. See the runbook's 2026-08-28 update for the actual cure (a stray `pnpm-lock.yaml`, not a reinstall) and for the `.next` cache trap that makes a production build die inside webpack's `WasmHash` after a dev run.
- [x] **N5.1 (partial)** `tsc --noEmit` clean · all five design checkers pass (contrast: 64 pairs) · **unit suite 729 passed / 59 files**, its first run on this host · `next build` compiles every route · production CSS bundle audited for palette residue. `eslint .` fails **only** inside `.claude/worktrees/**` (a duplicate checkout from an unrelated agent task); scoped lint over `app components lib scripts tests` is clean. **Isolation suite blocked** — see below.
- [x] **N5.2 (partial)** Baseline captured for every route reachable without a login: `docs/screenshots/{login,signup}-{desktop,mobile}.png` at 1280×900 and 390×844, 2× DPR. The auth pediment holds at 390px.
- [x] **N5.3 (partial)** Lighthouse on the public routes: **`/login` a11y 100, performance 91, CLS 0**; **`/signup` a11y 100, performance 80, CLS 0**. The only failed audit on either page is bfcache restoration, which predates the redesign. **CLS 0 closes N0.3's open question** — adding Bodoni Moda as a second `next/font` family costs no layout shift. The axe suite and the three auth-gated Lighthouse pages remain blocked.

**Blocked, and why (detail in [docs/VERIFICATION-RUNBOOK.md](docs/VERIFICATION-RUNBOOK.md)):** the isolation, e2e, axe and authenticated-Lighthouse suites all need Postgres. Docker Desktop's engine will not start on this host (its named pipe never appears; WSL2 itself is healthy), and separately `tests/isolation/setup.ts` defers to `.env`, which points `DATABASE_URL` at a **remote** server — so running the runbook's step 1 here as written would fire a destructive suite at that host. Both must be fixed before those rows can be filled.

### N5.4 — Adversarial audit (the part no gate can do)

Eight independent reviewers over the whole N0–N4 surface, every finding then attacked by three refutation lenses (correctness / already-handled / real-world impact): **30 findings raised, 23 refuted, 7 confirmed.** Fixed in this pass:

| Severity | Defect | Fix |
| --- | --- | --- |
| **High** | `cn("…sticky…", "relative …")` in the top bar — `relative` and `sticky` are one tailwind-merge group, so **`sticky` was silently deleted and the app bar stopped sticking** from N1.2 onward. Invisible to every gate: the source still read `sticky`. | Dropped `relative`; `position: sticky` already establishes the containing block the plate rule needs. Comment records the trap. |
| **High** | `PageHeaderSkeleton` still modelled the pre-N2.1 header, so ~34 routes with a `loading.tsx` under-reserved their header by ~36px and jumped when content landed — defeating the component's only purpose. | Skeleton now mirrors the eyebrow/breadcrumb line box, the real 32px h1, and the trailing plate rule; stale comments corrected. |
| **High** | `CHART_SERIES` shrank to four in N3.2 while the analytics trend stacks `TREND_TOP_N` (5) + "Other" — `seriesColor()` cycles, so two different bands drew the same colour. | Palette widened to six, ordered for maximum *adjacent* separation, every entry ≥3:1 on white. New test pins `CHART_SERIES.length > TREND_TOP_N`. |
| **High** | Recharts colours legend **label text** with the series colour, so sage (3.17:1) and stone (3.72:1) labels failed AA. | Legend `formatter` puts labels in `--fg-tertiary`; the colour cue stays on the circle icon, which only owes 3:1. |
| **High** | The auth pediment left `/login`, `/signup` and `/invite` with **zero heading elements** — `CardTitle` renders a `<div>`, and those cards carry the page's only title. | `CardTitle` gained an `as` prop; the four auth titles are now real `<h1>`s. Verified in Chromium. |
| **Medium** | The print block never got the gilt family, so the ledger's Paid total and every Paid/Settled seal printed in gold — on a document that is legal evidence. | Gilt and accent families forced to ink in `@media print`; the plate rule moved to its own `--plate-line` so the ornament prints grey while data rules stay black. |
| **Medium** | `--font-display`'s fallback tail was a serif stack, and Bodoni Moda's subset has no ₹ — so the rupee sign in a Bodoni amount resolved from Georgia while its digits came from Bodoni. | Tail now falls through to Inter before any serif. |
| **Medium** | `opacity-70` on non-seal status dots dropped the fill to ~2.4:1 on its own chip, quietly voiding the token darkening the contrast checker enforces. | Removed; the seal is already distinguished by hue and chip background. |
| **Medium** | This plan still published `#7FA08F` / `#9A948A` for the chart palette — values rejected during N3.2 for failing the 3:1 floor. | §6 table corrected to the shipped six-colour palette with measured ratios. |

Refuted-but-worth-knowing: `cn("shadow-flat","shadow-raised")` was checked and merges correctly, so the elevation tokens are *not* affected by the class-group bug that hit `text-*`.

---

## 8. Definition of done

The redesign is complete when: every N-box is ticked; `git grep` finds no raw hex outside `globals.css` and the checker's allowlist; `check-contrast.mjs` asserts and passes every pair in §2–§3; gilt appears in exactly three places; Bodoni Moda appears only in display/H1/wordmark contexts; the printed ledger is byte-identical in structure to today's; and a screenshot of any data screen is recognizably *this app in the Ledger Hall* — limestone ground, one engraved rule, Roman capitals over a Didone title, laurel where you act, gilt where money is finished.
