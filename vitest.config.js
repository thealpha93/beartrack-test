import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
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
