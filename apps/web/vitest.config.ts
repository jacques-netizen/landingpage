import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'test/empty.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    env: {
      DATABASE_URL: 'postgres://postgres@localhost:5432/mde_test',
      REDIS_URL: 'redis://localhost:6379',
      AUTH_SECRET: 'unit-test-secret-0123456789',
    },
  },
})
