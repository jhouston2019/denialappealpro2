import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@sentry/nextjs", "@sentry/node"],
  async rewrites() {
    return [
      {
        source: "/appeals/ai",
        destination: "/appeals/ai/index.html",
      },
      {
        source: "/appeals/learn",
        destination: "/appeals/learn/index.html",
      },
      {
        source: "/appeals/seo",
        destination: "/appeals/seo/index.html",
      },
    ];
  },
};

export default nextConfig;
