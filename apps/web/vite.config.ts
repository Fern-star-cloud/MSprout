import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries([
      '/api', '/auth', '/sanctum', '/login', '/logout', '/forgot-password',
      '/reset-password', '/email', '/user', '/two-factor-challenge', '/platform',
    ].map((prefix) => [prefix, { target: 'http://127.0.0.1:8000', changeOrigin: false }])),
  },
})
