import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
