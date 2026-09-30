import { defineConfig, devices } from '@playwright/test'

const webkitExecutablePath = process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 90_000,
  workers: 2,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'], channel: 'chrome' } },
    { name: 'webkit-phone', use: { ...devices['iPhone 13'], launchOptions: webkitExecutablePath ? { executablePath: webkitExecutablePath } : undefined } },
    { name: 'webkit-tablet', use: { ...devices['iPad (gen 7)'], launchOptions: webkitExecutablePath ? { executablePath: webkitExecutablePath } : undefined } },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    env: { VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
