import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Parquet Nerds — NBA stats for people who read box scores",
  description:
    "Modern NBA statistics, game logs, and analysis. Built by analysts, for analysts.",
};

const NAV_STATS = [
  { href: "/player/nikola-jokic", label: "Player Logs" },
  { href: "/series", label: "Series" },
  { href: "/preview", label: "Team Games" },
];
const NAV_ANALYSIS: { href: string; label: string }[] = [];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="nba-nav">
          <div className="nba-nav-inner">
            <Link href="/" className="nba-nav-brand">
              parquet nerds<span className="dot">.</span>
            </Link>
            <nav className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-(--nba-subtle)">
                  Stats
                </span>
                {NAV_STATS.map((item) => (
                  <Link key={item.href} href={item.href} className="nba-nav-link">
                    {item.label}
                  </Link>
                ))}
              </div>
              <span className="h-4 w-px bg-(--nba-border-2)" aria-hidden />
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-(--nba-subtle)">
                  Analysis
                </span>
                {NAV_ANALYSIS.length === 0 ? (
                  <span className="nba-nav-link text-(--nba-subtle) italic">
                    coming soon
                  </span>
                ) : (
                  NAV_ANALYSIS.map((item) => (
                    <Link key={item.href} href={item.href} className="nba-nav-link">
                      {item.label}
                    </Link>
                  ))
                )}
              </div>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <div className="max-w-[1400px] mx-auto px-6 py-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
