import type { Metadata, Viewport } from "next";
import { Bowlby_One, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WalletProvider } from "@/lib/wallet";

const display = Bowlby_One({ weight: "400", subsets: ["latin"], variable: "--f-display", display: "swap" });
const body = Space_Grotesk({ subsets: ["latin"], variable: "--f-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--f-mono", display: "swap" });

const site = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Chog Chaos League", template: "%s · Chog Chaos League" },
  description: "Your Chog is not a picture. It is a creature with a career. Provably fair chaos on Monad, replayable by anyone.",
  openGraph: { title: "Chog Chaos League", description: "Every Chog is a mischievous creature with a verifiable career. Watch the meadow. Replay the proof.", images: ["/og.png"], type: "website" },
  twitter: { card: "summary_large_image", title: "Chog Chaos League", description: "Provably fair Chog chaos on Monad.", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#0E091C", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <WalletProvider>
          <a href="#main" className="sr">Skip to content</a>
          <Nav />
          <main id="main">{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
