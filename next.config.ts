import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude better-sqlite3 from the webpack/turbopack bundle.
  // It's a native Node.js addon that must only run server-side.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
