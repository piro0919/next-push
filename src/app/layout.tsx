import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://next-push.kkweb.io"),
  applicationName: "next-push",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "next-push",
  },
  description: "Web Push notifications for Next.js App Router — live demo.",
  formatDetection: { telephone: false },
  title: "next-push — Web Push for Next.js",
};

export const viewport: Viewport = {
  themeColor: "#4338ca",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
