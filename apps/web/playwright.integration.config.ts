import { defineConfig } from '@playwright/test'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readdirSync, realpathSync } from 'node:fs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../.git/msprout-compat-b4-p2-1b-bde-20261019')
if (!process.env.COMPAT_BDE_OUTPUT || !process.env.COMPAT_BDE_ASSETS || !/^msprout-b4-p2-1b-bde-[a-f0-9]{10}-php$/.test(process.env.COMPAT_BDE_API ?? '')) throw Error('Set disposable BDE browser targets')
const output = resolve(process.env.COMPAT_BDE_OUTPUT)
if (dirname(output) !== root || (existsSync(output) && realpathSync(output) !== output) || (process.env.TEST_WORKER_INDEX === undefined && existsSync(output) && readdirSync(output).length)) throw Error('Preserve prior BDE evidence; use a fresh direct child')
export default defineConfig({
  testDir: './e2e/compatibility', testMatch: 'integration.spec.ts', workers: 1, retries: 0, timeout: 90_000,
  outputDir: output, reporter: [['list'], ['json', { outputFile: output + '/results.json' }]],
  // Real generated credentials/cookies stay in memory; no raw trace/HAR receipts.
  use: { trace: 'off', serviceWorkers: 'allow' },
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'webkit', use: { browserName: 'webkit', launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : undefined } },
  ],
})
