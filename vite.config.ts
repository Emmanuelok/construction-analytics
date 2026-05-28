import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Base path is set for GitHub Pages project site hosting:
// https://<user>.github.io/construction-analytics/
export default defineConfig({
  base: '/construction-analytics/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1800,
  },
})
