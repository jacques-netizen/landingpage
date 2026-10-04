import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@mde/ui', '@mde/config', '@mde/db'],
  poweredByHeader: false,
  // Project rules live in the root CLAUDE.md. Do not generate extra agent files here.
  agentRules: false,
}

export default config
