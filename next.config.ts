import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cloudflare quick tunnels to serve dev assets (HMR, JS bundles).
  // Wildcards are supported; covers any *.trycloudflare.com hostname.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
