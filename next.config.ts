import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@sentry/nextjs", "@sentry/node"],
  async redirects() {
    const hubs = ["learn", "ai", "seo"] as const;
    return hubs.map((hub) => ({
      source: `/appeals/${hub}/:path((?!.*\\.html$).+)`,
      destination: `https://www.denialappealpro.com/appeals/${hub}/:path.html`,
      permanent: true,
    }));
  },
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
