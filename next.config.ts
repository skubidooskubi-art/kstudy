import type { NextConfig } from "next";

const ngrokDomain = process.env.BETTER_AUTH_URL
  ? new URL(process.env.BETTER_AUTH_URL).hostname
  : "";

const nextConfig: NextConfig = {
  allowedDevOrigins: ngrokDomain ? [ngrokDomain] : [],
  output: "standalone",
};

export default nextConfig;
