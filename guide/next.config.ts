import type { NextConfig } from "next";

// Cache Components is off on purpose: every page in this app is either a
// client driven scene machine or a request time page (dashboard, guide), so
// the classic dynamic model is simpler and has fewer moving parts.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Migrations and guide content are read from disk at runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./drizzle/**", "./content/**"],
    "/dashboard": ["./drizzle/**"],
    "/": ["./drizzle/**"],
  },
  serverExternalPackages: ["playwright-core", "@electric-sql/pglite", "@sparticuz/chromium"],
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
