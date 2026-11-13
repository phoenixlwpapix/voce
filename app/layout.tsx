import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope, Newsreader, Noto_Sans } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { PwaClient } from "@/components/pwa-client";
import "./globals.css";

const serif = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-ibm-plex-mono", weight: ["400", "500"], display: "swap" });
// IPA and Japanese glyphs appear only in word content, so they load on demand instead of competing with first paint.
const ipa = Noto_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-noto-sans", weight: "400", display: "swap", preload: false });
const japanese = localFont({
  src: "./fonts/noto-sans-jp.woff2",
  variable: "--font-noto-sans-jp",
  weight: "400 500",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["sans-serif"],
});

export const metadata: Metadata = {
  title: { default: "Voce — 极简词典", template: "%s · Voce — 极简词典" },
  description: "Voce 极简词典支持英语、法语、西班牙语与日语查词、收藏和复习。",
  applicationName: "Voce",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Voce",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1c1c1a" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${serif.variable} ${sans.variable} ${mono.variable} ${ipa.variable} ${japanese.variable} antialiased`}>
        <Providers>{children}</Providers>
        <PwaClient />
      </body>
    </html>
  );
}
