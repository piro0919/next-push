import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["esbuild-wasm"],
  // NOTE: we intentionally do NOT set turbopack.root. pnpm stores packages
  // in a hoisted .pnpm store at the repo's parent directory when a higher
  // lockfile exists; pinning the root breaks CSS imports from that store.
  // Accept the "multiple lockfiles detected" warning as cosmetic.
};

export default nextConfig;
