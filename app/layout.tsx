import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope, Newsreader, Noto_Sans, Noto_Sans_JP } from "next/font/google";
import { Providers } from "@/components/providers";
import { PwaClient } from "@/components/pwa-client";
import "./globals.css";

const serif = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-ibm-plex-mono", weight: ["400", "500"], display: "swap" });
const ipa = Noto_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-noto-sans", weight: "400", display: "swap" });
const japanese = Noto_Sans_JP({ variable: "--font-noto-sans-jp", weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Voce — Personal Lexicon", template: "%s · Voce" },
  description: "A quiet multilingual vocabulary notebook for English, French, Spanish and Japanese.",
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${serif.variable} ${sans.variable} ${mono.variable} ${ipa.variable} ${japanese.variable} antialiased`}>
        <Providers>{children}</Providers>
        <PwaClient />
      </body>
    </html>
  );
}
