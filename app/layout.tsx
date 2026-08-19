import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
