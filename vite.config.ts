import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// The app is host-aware so the SAME build works everywhere:
//  - Vercel / Netlify serve at the domain root      -> base '/'
//  - GitHub Pages serves at a project sub-path        -> base '/construction-analytics/'
// Vercel sets VERCEL=1 and Netlify sets NETLIFY=true during their builds.
const servedAtRoot = !!process.env.VERCEL || !!process.env.NETLIFY
const base = process.env.VITE_BASE ?? (servedAtRoot ? '/' : '/construction-analytics/')

export default defineConfig({
  base,
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
