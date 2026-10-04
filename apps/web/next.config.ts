import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@mde/ui', '@mde/config', '@mde/db'],
  poweredByHeader: false,
  // Project rules live in the root CLAUDE.md. Do not generate extra agent files here.
  agentRules: false,
  // forbidden() renders app/forbidden.tsx with a 403 for staff-only pages.
  experimental: { authInterrupts: true },
}

export default config
