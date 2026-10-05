import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@mde/ui', '@mde/config', '@mde/db', '@mde/money', '@mde/campaigns'],
  poweredByHeader: false,
  // Project rules live in the root CLAUDE.md. Do not generate extra agent files here.
  agentRules: false,
  // No on-screen dev badge: it would show up in visual test screenshots taken against the dev server.
  devIndicators: false,
  // forbidden() renders app/forbidden.tsx with a 403 for staff-only pages.
  experimental: { authInterrupts: true },
}

export default config
