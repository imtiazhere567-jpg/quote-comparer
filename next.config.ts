import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local demo database) ships WASM files that must load from node_modules at runtime.
  // Lets a second dev server (e.g. for automated tests) run beside yours without sharing build files.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Hide the floating Next.js dev badge (it covers the sidebar user card).
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  // the schema files are read at runtime to set up a hosted database (Neon) automatically
  outputFileTracingIncludes: { "/**": ["./supabase/migrations/**"] },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
