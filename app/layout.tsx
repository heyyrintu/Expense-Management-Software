import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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
      <body className={`${inter.variable} font-sans antialiased`}>
        <MotionProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster />
        </MotionProvider>
      </body>
    </html>
  );
}
