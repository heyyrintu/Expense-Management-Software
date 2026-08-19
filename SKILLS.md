# SKILLS.md — Required Claude Code skills

Project skills live in `.claude/skills/<name>/SKILL.md` (created — ready to use). Claude Code auto-discovers them; invoke before starting matching work.

| Skill | When to use | Purpose |
|---|---|---|
| `add-feature-module` | Any new feature (expense CRUD, reports, budgets…) | End-to-end recipe: schema → scopedDb access → domain logic → server action → UI → tests, in the project's layout |
| `tenant-isolation-check` | After adding/changing any data access | Write the cross-tenant test proving org B can't touch org A's data; RLS checklist |
| `db-migration` | Any Prisma schema change | Safe migration rules: org_id + indexes, RLS policy for new tables, additive-first, seed update |
| `ui-screen` | Any new page/screen | shadcn/ui + Tailwind conventions, server-component-first, loading/empty/error states, mobile-first capture flows |
| `design-craft` | Any visual/layout/animation/component-styling work (all D0–D5 tasks) | Token-only styling, Apple-style restraint, Emil Kowalski motion rules, per-component and per-screen checklists. Authority: `DESIGN-PRD.md` |

Recommended general skills (install if available): frontend-design (polished UI), security-review (run before MVP demo, Milestone 4.3).

No MCP servers are required for the build; optional: GitHub MCP for PRs, Postgres MCP for DB inspection.
