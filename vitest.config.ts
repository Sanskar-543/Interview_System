import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    alias: {
      'node:test': path.resolve(__dirname, './tests/shims/node-test.ts')
    }
  },
})
