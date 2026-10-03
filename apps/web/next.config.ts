import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@mde/ui', '@mde/config', '@mde/db', '@mde/money'],
  poweredByHeader: false,
  experimental: { authInterrupts: true },
}

export default config
