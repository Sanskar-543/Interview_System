import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    alias: {
      'node:test': fileURLToPath(new URL('./tests/shims/node-test.js', import.meta.url))
    }
  },
})
