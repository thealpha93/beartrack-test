import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    environmentMatchGlobs: [
      ['tests/ui/**', 'jsdom'],
      ['**', 'node'],
    ],
    setupFiles: ['./tests/setup.js'],
  },
  resolve: {
    alias: { '@': new URL('.', import.meta.url).pathname },
  },
})
