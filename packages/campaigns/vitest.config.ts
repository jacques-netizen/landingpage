import { defineConfig } from 'vitest/config'

// Campaign tests use their own database so they can run alongside the other packages' tests.
export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    env: {
      DATABASE_URL: process.env.CAMPAIGNS_TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde_test_campaigns',
    },
  },
})
