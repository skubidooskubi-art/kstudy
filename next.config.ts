import type { NextConfig } from "next";

const ngrokDomain = process.env.BETTER_AUTH_URL
  ? new URL(process.env.BETTER_AUTH_URL).hostname
  : "";

const hermesTarget = process.env.HERMES_WEB_URL || "http://127.0.0.1:8645";

const nextConfig: NextConfig = {
  allowedDevOrigins: ngrokDomain ? [ngrokDomain] : [],
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/hermes-chat",
        destination: `${hermesTarget}/`,
      },
      {
        source: "/hermes-chat/:path*",
        destination: `${hermesTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
