/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'service-worker.ts',
      injectRegister: null,
      registerType: 'prompt',
      manifest: false,
      injectManifest: {
        globPatterns: ['index.html', 'assets/*.{js,css}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: {
    proxy: Object.fromEntries([
      '/api', '/auth', '/sanctum', '/login', '/logout', '/forgot-password',
      '/reset-password', '/email', '/user', '/two-factor-challenge', '/platform',
    ].map((prefix) => [prefix, { target: 'http://127.0.0.1:8000', changeOrigin: false }])),
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
