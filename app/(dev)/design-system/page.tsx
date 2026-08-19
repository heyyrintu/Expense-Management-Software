// Design system gallery (D0.1) — the token layer, rendered.
//
// Every swatch below is painted with a real utility class, so if a token is
// missing from the Tailwind theme the swatch goes transparent and the gap is
// obvious. Values and contrast ratios come from lib/design/tokens.ts, which
// the unit tests hold to the ≥4.5:1 contract.
//
// This route is deliberately outside (app): it is a developer reference, not
// a tenant screen, so it carries no session, no org scope and no data.
import type { Metadata } from "next";

import { MotionDemos } from "./motion-demos";
import { PrimitiveSpecimens } from "./primitives";
import { ShellSpecimens } from "./shell-specimens";
import { ReducedMotionIndicator } from "@/components/reduced-motion-indicator";
import {
  BRAND_FILL_PAIRS,
  COLOR_GROUPS,
  CONTRAST_CONTRACT,
  ELEVATION_SCALE,
  MOTION_TOKENS,
  RADIUS_SCALE,
  SPACING_SCALE,
  STATUS_TOKEN_MAP,
  TYPE_SCALE,
  contrastLevel,
  contrastRatio,
} from "@/lib/design/tokens";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-h2 text-text-primary">{title}</h2>
        <p className="text-body text-text-secondary max-w-2xl">{description}</p>
      </div>
      {children}
    </section>
  );
}

// Status swatch classes. The real StatusBadge (D0.3) owns this mapping in
// code; here it only demonstrates the tokens.
const STATUS_SWATCH: Record<string, string> = {
  success: "bg-status-success-subtle text-status-success-text",
  warning: "bg-status-warning-subtle text-status-warning-text",
  danger: "bg-status-danger-subtle text-status-danger-text",
  info: "bg-status-info-subtle text-status-info-text",
  neutral: "bg-status-neutral-subtle text-status-neutral-text",
};

function LevelChip({ ratio }: { ratio: number }) {
  const level = contrastLevel(ratio);
  const tone =
    level === "Fail"
      ? "bg-status-danger-subtle text-status-danger-text"
      : level === "AA Large"
        ? "bg-status-warning-subtle text-status-warning-text"
        : "bg-status-success-subtle text-status-success-text";
  return (
    <span className={`rounded-sm px-2 py-1 text-meta tabular ${tone}`}>
      {ratio.toFixed(2)} · {level}
    </span>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="bg-bg-app text-text-primary min-h-screen">
      <div className="mx-auto grid max-w-5xl gap-12 px-4 py-12 md:px-6">
        <header className="grid gap-2">
          <p className="text-meta text-text-tertiary uppercase">D0.1 · Token layer</p>
          <h1 className="text-h1">Design system</h1>
          <p className="text-body text-text-secondary max-w-2xl">
            Every visual value in the app, named. Components reference these
            tokens and never literal values — <code className="text-label">npm run lint</code>{" "}
            fails on raw hex and arbitrary Tailwind values.
          </p>
        </header>

        <Section
          title="Primitives"
          description="Every component and every state. Tab through them: each has a 2px accent focus ring at 2px offset, and every interactive control clears a 44px touch target."
        >
          <PrimitiveSpecimens />
        </Section>

        <Section
          title="App shell"
          description="Sidebar at both widths, top bar, mobile tab bar and the page header. Switch the role to check what each one sees — nav is filtered by role, but every route still runs its own server guard."
        >
          <ShellSpecimens />
        </Section>

        {COLOR_GROUPS.map((group) => (
          <Section key={group.title} title={group.title} description={group.description}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tokens.map((token) => (
                <div
                  key={token.name}
                  className="border-line bg-bg-surface grid gap-3 rounded-lg border p-4"
                >
                  <div
                    className="border-line h-12 rounded-md border"
                    style={{ background: `var(${token.cssVar})` }}
                  />
                  <div className="grid gap-1">
                    <code className="text-label text-text-primary">{token.name}</code>
                    <span className="text-meta text-text-tertiary tabular">
                      {token.cssVar} · {token.hex}
                    </span>
                    <span className="text-meta text-text-secondary">{token.usage}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ))}

        <Section
          title="Contrast contract"
          description="Every pair where a token carries text. All of these clear WCAG AA (4.5:1) and the unit tests fail the build if a token edit drops one below."
        >
          <ul className="border-line bg-bg-surface divide-line divide-y rounded-lg border">
            {CONTRAST_CONTRACT.map((pair) => {
              const ratio = contrastRatio(pair.foreground, pair.background);
              return (
                <li
                  key={pair.label}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="border-line grid size-12 place-items-center rounded-md border text-body-strong"
                      style={{ background: pair.background, color: pair.foreground }}
                    >
                      Aa
                    </span>
                    <span className="text-body text-text-secondary">{pair.label}</span>
                  </div>
                  <LevelChip ratio={ratio} />
                </li>
              );
            })}
          </ul>
        </Section>

        <Section
          title="Brand fills"
          description="The PRD's brand values, measured. These are fills — dots, borders, bars, chart series — and several miss AA as small text, which is why the -text shades exist. Recorded rather than assumed."
        >
          <ul className="border-line bg-bg-surface divide-line divide-y rounded-lg border">
            {BRAND_FILL_PAIRS.map((pair) => {
              const ratio = contrastRatio(pair.foreground, pair.background);
              return (
                <li key={pair.label} className="grid gap-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-body text-text-secondary">{pair.label}</span>
                    <LevelChip ratio={ratio} />
                  </div>
                  <p className="text-meta text-text-tertiary">{pair.note}</p>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section
          title="Status map"
          description="DESIGN-PRD §5.2 — the single source of truth for status colour. Only StatusBadge reads this; nothing else hand-colours a status."
        >
          <div className="border-line bg-bg-surface overflow-hidden rounded-lg border">
            <table className="w-full text-body">
              <thead className="bg-bg-subtle text-text-secondary text-label">
                <tr>
                  <th className="p-3 text-left font-medium">State</th>
                  <th className="p-3 text-left font-medium">Token</th>
                  <th className="p-3 text-left font-medium">Badge</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {STATUS_TOKEN_MAP.map((row) => (
                  <tr key={row.state}>
                    <td className="text-text-primary p-3">{row.state}</td>
                    <td className="text-text-secondary p-3">
                      <code className="text-label">status-{row.token}</code>
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-sm px-2 py-1 text-meta ${STATUS_SWATCH[row.token]}`}
                      >
                        {row.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="Type scale"
          description="Inter, variable, via next/font. Max three sizes per screen; never bold a label and its value both. All numerals are tabular."
        >
          <div className="border-line bg-bg-surface divide-line grid divide-y rounded-lg border">
            {TYPE_SCALE.map((type) => (
              <div key={type.name} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-baseline">
                <p className={type.className}>
                  ₹1,24,500.00 — {type.role}
                </p>
                <span className="text-meta text-text-tertiary tabular">
                  {type.className} · {type.size}/{type.lineHeight} · {type.weight} ·{" "}
                  {type.tracking}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Spacing"
          description="4px base. These ten steps are the whole scale — nothing off-grid."
        >
          <div className="border-line bg-bg-surface grid gap-2 rounded-lg border p-4">
            {SPACING_SCALE.map((step) => (
              <div key={step.step} className="flex items-center gap-3">
                <span className="text-meta text-text-tertiary tabular w-16">
                  {step.step} · {step.px}px
                </span>
                <span
                  className="bg-accent-subtle border-accent-border h-4 rounded-sm border"
                  style={{ width: `${step.px}px` }}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Radius" description="Four values, matched to component size.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RADIUS_SCALE.map((radius) => (
              <div key={radius.name} className="grid gap-2">
                <div
                  className={`bg-accent-subtle border-accent-border h-20 border ${radius.className}`}
                />
                <code className="text-label">{radius.className}</code>
                <span className="text-meta text-text-tertiary">
                  {radius.px} · {radius.usage}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Elevation"
          description="Four levels. A strong border and a strong shadow never appear together."
        >
          <div className="bg-bg-subtle grid gap-6 rounded-lg p-6 sm:grid-cols-2 lg:grid-cols-4">
            {ELEVATION_SCALE.map((elevation) => (
              <div key={elevation.name} className="grid gap-2">
                <div
                  className={`bg-bg-surface border-line h-20 rounded-lg border ${elevation.className}`}
                />
                <code className="text-label">{elevation.className}</code>
                <span className="text-meta text-text-tertiary">{elevation.usage}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Motion"
          description="Enter with ease-out, exit with ease-in, 300ms ceiling. Hover a swatch to see its duration; reduced motion removes the transform and keeps the fade."
        >
          <div className="border-line bg-bg-surface divide-line grid divide-y rounded-lg border">
            {MOTION_TOKENS.map((token) => (
              <div key={token.name} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="grid gap-1">
                  <code className="text-label">{token.name}</code>
                  <span className="text-meta text-text-tertiary">{token.usage}</span>
                </div>
                <span className="text-meta text-text-secondary tabular">{token.value}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Motion variants"
          description="Enter with ease-out, exit with ease-in, 300ms ceiling, transform and opacity only. Replay is spammable on purpose — every variant has to survive being interrupted mid-flight."
        >
          <div className="grid gap-4">
            <ReducedMotionIndicator />
            <MotionDemos />
          </div>
        </Section>

        <Section
          title="Numerals"
          description="Every amount uses tabular figures so columns line up and digits don't jitter as values change."
        >
          <div className="border-line bg-bg-surface grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-label text-text-secondary">Proportional (wrong)</span>
              <span className="text-body-strong">₹1,11,111.11</span>
              <span className="text-body-strong">₹8,88,888.88</span>
            </div>
            <div className="grid gap-1">
              <span className="text-label text-text-secondary">Tabular (.amount)</span>
              <span className="amount text-body-strong">₹1,11,111.11</span>
              <span className="amount text-body-strong">₹8,88,888.88</span>
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}
