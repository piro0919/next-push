import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "next-push demo",
  description: "Web Push for Next.js — live demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>{children}</body>
    </html>
  );
}
