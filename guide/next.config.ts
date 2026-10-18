import type { NextConfig } from "next";

// Cache Components is off on purpose: every page in this app is either a
// client driven scene machine or a request time page (dashboard, guide), so
// the classic dynamic model is simpler and has fewer moving parts.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Migrations and guide content are read from disk at runtime.
  // The PDF renderer also embeds fonts and brand images read at runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./drizzle/**", "./content/**", "./assets/fonts/**", "./public/brand/**", "./node_modules/@sparticuz/chromium/bin/**"],
    "/g/**": ["./drizzle/**", "./content/**"],
    "/u/**": ["./drizzle/**"],
    "/dashboard": ["./drizzle/**"],
    "/": ["./drizzle/**", "./content/**"],
  },
  // The seven secrets page answers on its own hostname once that domain is attached to this Vercel project.
  // On every other host it stays at /secrets. The guide funnel keeps the root on its own domain.
  async rewrites() {
    return [
      { source: "/", destination: "/secrets", has: [{ type: "host", value: "secrets.maisondelites.com" }] },
      { source: "/", destination: "/secrets", has: [{ type: "host", value: "www.secrets.maisondelites.com" }] },
    ];
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
