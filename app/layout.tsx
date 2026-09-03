import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { MotionProvider } from "@/components/motion-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// ── Fonts are SELF-HOSTED, and each family comes in two files ─────────────
//
// These used to come from next/font/google. That preloads the `latin`
// subset and declares every other subset with a unicode-range, so the
// browser fetches one the moment a page uses a glyph from it. The rupee
// sign is not in Google's latin range. It is in latin-ext — so the first
// "₹" on every screen pulled another 84 KB of Inter and 25 KB of Bodoni,
// discovered only after layout, on top of the 94 KB already preloaded. On
// the mobile Lighthouse profile that was the gap between first paint and
// LCP, and the amounts — the thing this app exists to show — repainted late.
//
// Now each family is the SAME latin file Google served (committed under
// app/fonts, still preloaded, still variable-weight), and Inter carries a
// companion face holding only the glyphs this codebase uses from outside
// latin — today just "₹", about a kilobyte, built by
// scripts/subset-symbol-fonts.mjs. globals.css lists it straight after
// Inter in both --font-sans and --font-display, so a rupee sign falls
// through to it per glyph and nothing else ever triggers a download. Bodoni
// has no companion on purpose: the ₹ in a hero amount resolves from Inter so
// it matches every other amount on the screen (see globals.css). Glyphs
// outside these files (→, ✓, ⌘) render from the system font, exactly as
// they did before.
//
// `display: swap` keeps text readable before the face arrives; the fallback
// metrics (`adjustFontFallback`) size the system stand-in to the real face so
// the swap does not reflow.

// Inter, variable weight 100–900, latin. Exposed as --font-inter, which
// globals.css maps to --font-sans.
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: "Arial",
});

const interSymbols = localFont({
  src: "./fonts/inter-symbols.woff2",
  weight: "100 900",
  variable: "--font-inter-symbols",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+20B9" }],
});

// Bodoni Moda, variable weight 400–900 with the optical-sizing axis, latin.
// The display face of the Ledger Hall redesign (N0.3): globals.css maps it
// to --font-display, whose jurisdiction is text-display, text-h1 and the
// auth wordmark ONLY — Inter keeps body, controls and every column of
// numbers (Bodoni has no tabular figures). It renders above the fold on
// every page (the H1), so it is preloaded; `swap` keeps the title readable
// before the face arrives.
const bodoni = localFont({
  src: "./fonts/bodoni-moda-latin.woff2",
  weight: "400 900",
  variable: "--font-bodoni",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: "Expense Management",
  description: "Multi-tenant expense management",
};

// `viewportFit: "cover"` is what makes env(safe-area-inset-*) resolve to a
// real value on notched devices — without it the mobile tab bar would stop
// short of the screen edge and the .pb-safe utility would always be 0.
// `maximumScale` is deliberately left at the default: capping zoom is an
// accessibility failure, and §8 requires we don't commit one.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${interSymbols.variable} ${bodoni.variable} font-sans antialiased`}
      >
        <MotionProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster />
        </MotionProvider>
      </body>
    </html>
  );
}
