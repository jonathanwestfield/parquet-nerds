import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cloudflare quick tunnels to serve dev assets (HMR, JS bundles).
  // Wildcards are supported; covers any *.trycloudflare.com hostname.
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Bundle the SQLite file with serverless functions on Vercel.
  outputFileTracingIncludes: {
    "/**/*": ["./data/nba.db"],
  },
  // better-sqlite3 has native bindings; don't try to bundle it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
