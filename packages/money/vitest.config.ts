import { defineConfig } from 'vitest/config'

// Money tests use their own database so they can run alongside the db package's tests.
export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    env: { DATABASE_URL: process.env.MONEY_TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde_test_money' },
  },
})
