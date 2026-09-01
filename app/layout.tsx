import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Inter } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Inter, variable weight, latin subset. `display: swap` so text is readable
// immediately; the variable font means every weight in the type scale
// (§5.3) comes from one file. Exposed as --font-inter, which globals.css
// maps to --font-sans.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Bodoni Moda, variable weight with the optical-sizing axis, latin subset.
// The display face of the Ledger Hall redesign (N0.3): globals.css maps it
// to --font-display, whose jurisdiction is text-display, text-h1 and the
// auth wordmark ONLY — Inter keeps body, controls and every column of
// numbers (Bodoni has no tabular figures). It renders above the fold on
// every page (the H1), so next/font preloads it; `swap` keeps the title
// readable before the face arrives.
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
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
      <body className={`${inter.variable} ${bodoni.variable} font-sans antialiased`}>
        <MotionProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster />
        </MotionProvider>
      </body>
    </html>
  );
}
