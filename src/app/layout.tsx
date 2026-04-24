import type { Metadata } from "next";
import localFont from "next/font/local";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";

import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.defaultUrl),
  title: {
    default: "GitPulse",
    template: "%s · GitPulse",
  },
  description: siteConfig.description,
  openGraph: {
    title: "GitPulse",
    description: siteConfig.description,
    siteName: "GitPulse",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GitPulse",
    description: siteConfig.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn(geistSans.variable, geistMono.variable)}
    >
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
