// Tokens (D0.5). Every colour in the product, measured.
//
// The swatches in the groups below are painted from the CSS VARIABLE, which
// is what makes their measured hex trustworthy. That is deliberately not the
// same thing as painting them with a Tailwind utility — see the "Utility
// resolution" block at the end, which exists because the difference between
// those two hid a real defect for five milestones (D-5).
//
// Every swatch carries BOTH reference ratios — against the white surface it
// will usually sit on, and against text-primary, the ink that will usually
// sit on it. One number answers "can I put this on a card", the other answers
// "can I put words on it". Guessing at either is how a palette quietly drifts
// out of AA.
import {
  BRAND_FILL_PAIRS,
  COLOR_GROUPS,
  CONTRAST_CONTRACT,
  REFERENCE_COLORS,
  STATUS_TOKEN_MAP,
  contrastLevel,
  contrastRatio,
} from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { Block, Group } from "./shared";

/**
 * A measured contrast ratio with its WCAG grade. Graded with the status
 * tokens, so the gallery flags its own accessibility failures in the same
 * vocabulary the app uses for everything else.
 *
 * Lives here rather than in shared.tsx so the contrast maths and the hex
 * registry it needs stay out of the client sections' bundle — nothing in the
 * gallery's interactive half has any use for them.
 */
function LevelChip({ ratio, prefix }: { ratio: number; prefix?: string }) {
  const level = contrastLevel(ratio);
  const tone =
    level === "Fail"
      ? "bg-status-danger-subtle text-status-danger-text"
      : level === "AA Large"
        ? "bg-status-warning-subtle text-status-warning-text"
        : "bg-status-success-subtle text-status-success-text";
  return (
    <span className={cn("rounded-sm px-2 py-1 text-meta tabular", tone)}>
      {prefix ? `${prefix} ` : ""}
      {ratio.toFixed(2)} · {level}
    </span>
  );
}

/**
 * The utility-class ↔ CSS-variable pairs (D-5).
 *
 * The swatch grids above paint from `var(--token)`, which proves the token
 * exists and measures what it claims. It does NOT prove that the Tailwind
 * class of the same name resolves to it — and for five milestones it didn't:
 * a leftover shadcn `@theme inline` block re-declared `--color-accent` as a
 * near-white, and since Tailwind v4 merges @theme last-wins, `bg-accent`
 * silently painted that near-white while this page cheerfully showed indigo.
 *
 * So these rows paint both ways at once. The classes are written out in full
 * because Tailwind scans source text: an interpolated class name generates no
 * CSS and would fail as a transparent half, which — confusingly — is also
 * what a genuinely broken mapping looks like.
 */
const UTILITY_RESOLUTION: Array<{ className: string; cssVar: string }> = [
  // The accent family — the one that broke, and the app's only brand colour.
  { className: "bg-accent", cssVar: "--accent-base" },
  { className: "bg-accent-hover", cssVar: "--accent-hover-base" },
  { className: "bg-accent-pressed", cssVar: "--accent-pressed-base" },
  { className: "bg-accent-subtle", cssVar: "--accent-subtle-base" },
  { className: "bg-accent-border", cssVar: "--accent-border-base" },
  { className: "bg-accent-solid", cssVar: "--accent-solid-base" },
  { className: "bg-accent-text", cssVar: "--accent-text-base" },
  { className: "bg-focus-ring", cssVar: "--focus-ring-base" },
  // Surfaces and lines — every screen's background comes through these.
  { className: "bg-bg-app", cssVar: "--bg-app" },
  { className: "bg-bg-surface", cssVar: "--bg-surface" },
  { className: "bg-bg-subtle", cssVar: "--bg-subtle" },
  { className: "bg-line", cssVar: "--line" },
  { className: "bg-line-strong", cssVar: "--line-strong" },
  // Status fills — StatusBadge reads these through TONE_CLASSES.
  { className: "bg-status-success", cssVar: "--status-success" },
  { className: "bg-status-warning", cssVar: "--status-warning" },
  { className: "bg-status-danger", cssVar: "--status-danger" },
  { className: "bg-status-info", cssVar: "--status-info" },
  { className: "bg-status-neutral", cssVar: "--status-neutral" },
];

const STATUS_SWATCH: Record<string, string> = {
  success: "bg-status-success-subtle text-status-success-text",
  warning: "bg-status-warning-subtle text-status-warning-text",
  danger: "bg-status-danger-subtle text-status-danger-text",
  info: "bg-status-info-subtle text-status-info-text",
  neutral: "bg-status-neutral-subtle text-status-neutral-text",
};

export function TokensSection() {
  return (
    <Group
      id="tokens"
      eyebrow="§5.1 · §5.2"
      title="Tokens"
      description="Every colour the product may use, with its CSS variable, its hex, and its measured contrast against the white surface and against text-primary. Components reference these names and never a literal value — npm run lint fails on raw hex."
    >
      {COLOR_GROUPS.map((group) => (
        <Block key={group.title} title={group.title} description={group.description}>
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
                <div className="flex flex-wrap gap-2">
                  <LevelChip
                    prefix="vs white"
                    ratio={contrastRatio(token.hex, REFERENCE_COLORS.surface)}
                  />
                  <LevelChip
                    prefix="vs ink"
                    ratio={contrastRatio(token.hex, REFERENCE_COLORS.textPrimary)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Block>
      ))}

      <Block
        title="Contrast contract"
        description="Every pair where a token actually carries text. All of these clear WCAG AA (4.5:1), and tests/unit/design-tokens.test.ts fails the build if a token edit drops one below."
      >
        <ul className="border-line bg-bg-surface divide-line divide-y rounded-lg border">
          {CONTRAST_CONTRACT.map((pair) => (
            <li key={pair.label} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span
                  className="border-line grid size-12 place-items-center rounded-md border text-body-strong"
                  style={{ background: pair.background, color: pair.foreground }}
                >
                  Aa
                </span>
                <span className="text-body text-text-secondary">{pair.label}</span>
              </div>
              <LevelChip ratio={contrastRatio(pair.foreground, pair.background)} />
            </li>
          ))}
        </ul>
      </Block>

      <Block
        title="Brand fills"
        description="The PRD's brand values, measured rather than assumed. These are fills — dots, borders, bars, chart series — and several miss AA as small text, which is exactly why the -text shades exist."
      >
        <ul className="border-line bg-bg-surface divide-line divide-y rounded-lg border">
          {BRAND_FILL_PAIRS.map((pair) => (
            <li key={pair.label} className="grid gap-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-body text-text-secondary">{pair.label}</span>
                <LevelChip ratio={contrastRatio(pair.foreground, pair.background)} />
              </div>
              <p className="text-meta text-text-tertiary">{pair.note}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block
        title="Status map"
        description="DESIGN-PRD §5.2, the single source of truth for status colour. lib/design/status.ts holds it in code and StatusBadge is its only renderer — nothing else hand-colours a status."
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
                    <span className={`rounded-sm px-2 py-1 text-meta ${STATUS_SWATCH[row.token]}`}>
                      {row.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block
        title="Utility resolution"
        description="Each row is one colour painted twice: the left half by its Tailwind utility class, the right half by its CSS variable. They are the same colour, so a row reads as one solid block. A visible seam means the @theme mapping and the token have come apart — which is exactly what happened to bg-accent."
      >
        <ul className="border-line bg-bg-surface divide-line divide-y rounded-lg border">
          {UTILITY_RESOLUTION.map((row) => (
            <li key={row.className} className="flex flex-wrap items-center gap-4 p-4">
              <div className="border-line flex h-10 w-40 shrink-0 overflow-hidden rounded-md border">
                {/* Literal class strings, never interpolated: Tailwind's
                    scanner reads source text, so a computed `bg-${name}`
                    would generate nothing and paint transparent. */}
                <div className={cn("w-1/2", row.className)} />
                <div className="w-1/2" style={{ background: `var(${row.cssVar})` }} />
              </div>
              <div className="grid gap-1">
                <code className="text-label text-text-primary">{row.className}</code>
                <span className="text-meta text-text-tertiary tabular">{row.cssVar}</span>
              </div>
            </li>
          ))}
        </ul>
      </Block>
    </Group>
  );
}
