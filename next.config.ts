import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@sentry/nextjs", "@sentry/node"],
};

export default nextConfig;
