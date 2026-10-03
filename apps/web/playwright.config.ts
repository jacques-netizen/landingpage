import { defineConfig } from '@playwright/test'

const PORT = 3100
const TEST_DB =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/mde_test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
  },
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DB,
      REDIS_URL: 'redis://localhost:6379',
      AUTH_SECRET: 'e2e-only-secret-0123456789abcdef0123',
      AUTH_URL: `http://localhost:${PORT}`,
      DEV_EMAIL_OUTBOX: '/tmp/mde-e2e-outbox.jsonl',
      NODE_ENV: 'development',
    },
  },
})
