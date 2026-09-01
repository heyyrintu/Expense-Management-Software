// Spacing · Radius · Elevation (D0.5) — §5.4, rendered at true size.
import {
  ELEVATION_SCALE,
  RADIUS_SCALE,
  SPACING_SCALE,
} from "@/lib/design/tokens";
import { Block, Group } from "./shared";

export function ScalesSection() {
  return (
    <Group
      id="scales"
      eyebrow="§5.4"
      title="Spacing, radius, elevation"
      description="Three short scales. Their shortness is the feature: with ten spacing steps, four radii and four elevations there is no room to improvise, and every screen ends up on the same grid without anyone coordinating."
    >
      <Block
        title="Spacing"
        description="4px base. These ten steps are the entire scale — nothing off-grid, and the lint enforces it."
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
      </Block>

      <Block
        title="Radius"
        description="Four values, matched to component size. A badge and a card are not the same shape at different scales — the smaller the box, the tighter the corner."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {RADIUS_SCALE.map((radius) => (
            <div key={radius.name} className="grid gap-2">
              <div className={`bg-accent-subtle border-accent-border h-20 border ${radius.className}`} />
              <code className="text-label">{radius.className}</code>
              <span className="text-meta text-text-tertiary">
                {radius.px} · {radius.usage}
              </span>
            </div>
          ))}
        </div>
      </Block>

      <Block
        title="Elevation"
        description="Four levels, on a grey field so the shadows are visible. A strong border and a strong shadow never appear together — flat things get the border, floating things get the shadow."
      >
        <div className="bg-bg-subtle grid gap-6 rounded-lg p-6 sm:grid-cols-2 lg:grid-cols-4">
          {ELEVATION_SCALE.map((elevation) => (
            <div key={elevation.name} className="grid gap-2">
              <div className={`bg-bg-surface border-line h-20 rounded-lg border ${elevation.className}`} />
              <code className="text-label">{elevation.className}</code>
              <span className="text-meta text-text-tertiary">{elevation.usage}</span>
            </div>
          ))}
        </div>
      </Block>

      <Block
        title="The plate rule"
        description="The redesign's one sanctioned ornamental line (N0.4): two 1px hairlines, 3px apart, like the ruled head of an engraved plate. Exactly three positions may carry it — under a page header, as a StatCard's top edge, as the top bar's bottom edge. Tables and cards keep their single hairlines; a fourth position goes through the token exception process, not a call site."
      >
        <div className="bg-bg-surface border-line grid gap-4 rounded-lg border p-6">
          <span className="eyebrow text-text-tertiary">Section eyebrow</span>
          <p className="text-h1 font-display text-text-primary">A page title above the rule</p>
          <div aria-hidden="true" className="plate-rule" />
          <code className="text-meta text-text-tertiary">
            .plate-rule — a standalone 4px element; mark it aria-hidden, it is punctuation, not content
          </code>
        </div>
      </Block>
    </Group>
  );
}
