import { defineConfig } from '@playwright/test'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readdirSync, realpathSync } from 'node:fs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../.git/msprout-compat-b4-p2-2-20261019')
if (!process.env.COMPAT_SNAPSHOTS_OUTPUT || !process.env.COMPAT_SNAPSHOTS_ASSETS || !/^msprout-b4-p2-2-[a-f0-9]{10}-php$/.test(process.env.COMPAT_SNAPSHOTS_API ?? '')) throw Error('Set disposable snapshot browser targets')
const output = resolve(process.env.COMPAT_SNAPSHOTS_OUTPUT)
if (dirname(output) !== root || (existsSync(output) && realpathSync(output) !== output) || (process.env.TEST_WORKER_INDEX === undefined && existsSync(output) && readdirSync(output).length)) throw Error('Preserve prior snapshot evidence; use a fresh direct child')
export default defineConfig({
  testDir: './e2e/compatibility', testMatch: 'snapshots.spec.ts', workers: 1, retries: 0, timeout: 90_000,
  outputDir: output, reporter: [['list'], ['json', { outputFile: output + '/results.json' }]],
  // Real generated credentials/cookies stay in memory; no raw trace/HAR receipts.
  use: { trace: 'off', serviceWorkers: 'allow' },
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'webkit', use: { browserName: 'webkit', launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : undefined } },
  ],
})
