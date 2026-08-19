// Design system gallery (D0.5) — the project's review surface.
//
// WHAT THIS PAGE IS FOR. Before touching a component, look at it here. After
// touching one, look at it here again. Every token, every primitive in every
// state, every domain component, every motion variant and the empty/loading/
// error trio, on one page, against the same background. If a state isn't on
// this page it isn't specified; if it looks wrong here it looks wrong
// everywhere.
//
// It is also deliberately honest about what ISN'T done: the domain section
// carries a roster of §6.2 components not yet built and marks the components
// that still deviate from the token layer, each with the task that fixes it.
//
// ACCESS: open in development, org_admin in production — enforced by
// app/(dev)/layout.tsx, decided by lib/design/gallery-access.ts.
//
// The route sits outside (app) on purpose: it is a developer reference, not a
// tenant screen, so it carries no session, no org scope and no tenant data.
import type { Metadata } from "next";

import { ReducedMotionIndicator } from "@/components/reduced-motion-indicator";
import { MOTION_TOKENS } from "@/lib/design/tokens";
import { ApprovalSection } from "./sections/approval-section";
import { CaptureSection } from "./sections/capture-section";
import { ComponentsSection } from "./sections/components-section";
import { DomainSection } from "./sections/domain-section";
import { FiltersSection } from "./sections/filters-section";
import { KpiSection } from "./sections/kpi-section";
import { MoneySection } from "./sections/money-section";
import { MotionDemos } from "./sections/motion-section";
import { PatternsSection } from "./sections/patterns-section";
import { ReceiptSection } from "./sections/receipt-section";
import { ReportSection } from "./sections/report-section";
import { ScalesSection } from "./sections/scales-section";
import { ShellSection } from "./sections/shell-section";
import { TableSection } from "./sections/table-section";
import { TokensSection } from "./sections/tokens-section";
import { TypographySection } from "./sections/typography-section";
import { Block, Group } from "./sections/shared";
import { TableOfContents } from "./toc";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return (
    <div className="bg-bg-app text-text-primary min-h-screen">
      <header className="border-line bg-bg-surface sticky top-0 z-20 border-b">
        <div className="mx-auto flex h-topbar max-w-content items-center justify-between gap-4 px-4 md:px-6">
          <span className="text-h3">Design system</span>
          <span className="text-meta text-text-tertiary hidden sm:inline">
            DESIGN-PRD §5 · §6 · §7
          </span>
        </div>
      </header>

      {/* Flex rather than a grid template, so the contents column reuses the
          w-sidebar token instead of an arbitrary 240px. */}
      <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-8 md:px-6 lg:flex-row lg:gap-12">
        <div className="lg:w-sidebar lg:shrink-0">
          <TableOfContents />
        </div>

        <main className="grid min-w-0 flex-1 gap-16">
          <div className="grid gap-2">
            <h1 className="text-h1">Every visual decision, in one place</h1>
            <p className="text-body text-text-secondary max-w-2xl">
              Components reference tokens and never literal values —{" "}
              <code className="text-label">npm run lint</code> fails on raw hex
              and arbitrary Tailwind values. Any new or changed component is
              added to this page in the same commit that introduces it.
            </p>
          </div>

          <TokensSection />
          <TypographySection />
          <MoneySection />
          <ScalesSection />

          <Group
            id="components"
            eyebrow="§6.1"
            title="Components"
            description="Every primitive and every state. Tab through them: each carries a 2px accent focus ring at 2px offset, and every interactive control clears a 44px touch target."
          >
            <ComponentsSection />
          </Group>

          <Group
            id="shell"
            eyebrow="§5.5"
            title="App shell"
            description="Sidebar at both widths, top bar, mobile tab bar and the page header. Switch the role to check what each surface shows — the nav is filtered by role, but every route still runs its own server guard."
          >
            <ShellSection />
          </Group>

          <TableSection />

          <FiltersSection />

          <KpiSection />

          <CaptureSection />

          <ReceiptSection />

          <ReportSection />

          <ApprovalSection />

          <DomainSection />

          <Group
            id="motion"
            eyebrow="§4.4 · §5.6"
            title="Motion"
            description="Enter with ease-out, exit with ease-in, 300ms ceiling, transform and opacity only. Every animation in the app comes from lib/motion.ts, and every demo below replays the real variant."
          >
            <Block
              title="Tokens"
              description="Four durations and two curves. A component that writes its own numbers has opted out of the design system."
            >
              <div className="border-line bg-bg-surface divide-line grid divide-y rounded-lg border">
                {MOTION_TOKENS.map((token) => (
                  <div
                    key={token.name}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div className="grid gap-1">
                      <code className="text-label">{token.name}</code>
                      <span className="text-meta text-text-tertiary">{token.usage}</span>
                    </div>
                    <span className="text-meta text-text-secondary tabular">{token.value}</span>
                  </div>
                ))}
              </div>
            </Block>

            <Block
              title="Variants"
              description="Replay is spammable on purpose — every variant has to survive being interrupted mid-flight, and clicking fast is how you check."
            >
              <div className="grid gap-4">
                <ReducedMotionIndicator />
                <MotionDemos />
              </div>
            </Block>
          </Group>

          <PatternsSection />
        </main>
      </div>
    </div>
  );
}
