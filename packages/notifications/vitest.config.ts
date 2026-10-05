import { defineConfig } from 'vitest/config'

// Notification tests use their own database so they can run alongside the other packages' tests.
export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    env: {
      DATABASE_URL:
        process.env.NOTIFICATIONS_TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde_test_notifications',
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'test-only-secret-0123456789abcdef',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      APP_URL: 'https://app.example.test',
      LEGAL_ENTITY: 'Example Legal Entity Ltd',
    },
  },
})
