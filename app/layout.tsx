import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scale Your Offers — Outreach Agent",
  description: "Draft cold outreach in your own voice, informed by what's actually worked.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
