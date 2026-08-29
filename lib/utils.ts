import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge does not know this project's custom theme, and its guess
 * was WRONG in a way that silently broke the type scale (found in N2.2):
 * it put `text-display` (a font-size utility from §5.3) and
 * `text-text-primary` (a colour utility) in the same ambiguity group and
 * kept only the last — so `cn("text-display", "text-text-primary")`
 * dropped the size, and every <Amount> rendered at its inherited size
 * instead of the scale's. The extension below teaches it the real groups:
 * the nine §5.3 sizes are font-size; the token colour names are text-colour.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "h1",
            "h2",
            "h3",
            "body",
            "body-strong",
            "label",
            "meta",
            "micro",
            "eyebrow",
          ],
        },
      ],
      "text-color": [
        {
          text: [
            "text-primary",
            "text-secondary",
            "text-tertiary",
            "text-on-accent",
            "accent",
            "accent-text",
            "gilt",
            "gilt-text",
            (v: string) => v.startsWith("status-"),
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
