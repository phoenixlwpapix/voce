import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope, Newsreader, Noto_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const serif = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-ibm-plex-mono", weight: ["400", "500"], display: "swap" });
const ipa = Noto_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-noto-sans", weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Voce — Personal Lexicon", template: "%s · Voce" },
  description: "A quiet multilingual vocabulary notebook for English, French and Spanish.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${serif.variable} ${sans.variable} ${mono.variable} ${ipa.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
