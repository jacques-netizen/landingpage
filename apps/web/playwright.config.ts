import { defineConfig } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 3100)

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    // Same Chromium build the reference screenshots were captured with.
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  // Visual tests run first, against the seeded data only; flow tests that create campaigns run after.
  projects: [
    { name: 'visual', testMatch: /designed-screens\.spec\.ts/ },
    { name: 'flows', testIgnore: /designed-screens\.spec\.ts/, dependencies: ['visual'] },
  ],
  webServer: {
    command: process.env.E2E_SERVER_COMMAND ?? `pnpm start -p ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
