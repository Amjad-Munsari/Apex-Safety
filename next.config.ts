import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile in the home directory otherwise
  // makes Turbopack treat ~/ as the root and crawl all of it (minutes-long
  // compiles on iCloud-synced machines).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
