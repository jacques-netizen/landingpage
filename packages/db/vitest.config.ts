import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // One shared test database, so files run one after another.
    fileParallelism: false,
    testTimeout: 20_000,
  },
})
