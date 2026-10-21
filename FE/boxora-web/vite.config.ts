import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Libraries only reached through lazy routes/modals: pre-bundle them at startup so the
  // dev server never answers "504 Outdated Optimize Dep" on the first visit to those pages.
  optimizeDeps: {
    include: ['qrcode', 'html5-qrcode', 'motion/react'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Uploaded evidence / documents are served by the backend under /uploads.
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
