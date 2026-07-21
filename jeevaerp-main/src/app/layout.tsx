import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Geist, Geist_Mono, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

/* The staff portals' type system — Geist for the UI, Geist Mono for data
   (IDs, prices, timings). The modern-software sans, scoped to .portal so the
   public marketing site keeps its own display faces. */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

/* The portals' heading face (.font-serif-p) — italic included, since the
   reception theme leans on the serif italic accent. */
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Jeeva Multispeciality Hospital — Hanamkonda",
    template: "%s — Jeeva Multispeciality Hospital",
  },
  description:
    "Your health, our care. Multispeciality hospital in Hanamkonda: 24/7 emergency, specialized doctors, in-house diagnostics and pharmacy.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable} ${plexMono.variable} ${fraunces.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
