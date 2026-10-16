import { defineConfig } from '@playwright/test'
import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.env.COMPAT_B2_CANDIDATE || !process.env.COMPAT_B2_OUTPUT) throw Error('Set identified B2 candidate and fresh isolated output')
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../.git/msprout-compat-b2-20261016'))
const output = resolve(process.env.COMPAT_B2_OUTPUT)
if (dirname(output) !== root) throw Error('Use fresh direct-child B2 output')
if (process.env.TEST_WORKER_INDEX === undefined && existsSync(output) && (realpathSync(output) !== output || readdirSync(output).length)) throw Error('Preserve previous test storage and evidence')
export default defineConfig({
  testDir: './e2e/compatibility', testMatch: 'reader.spec.ts', workers: 1, retries: 0, timeout: 90_000,
  outputDir: output, reporter: [['list'], ['json', { outputFile: `${output}/results.json` }]],
  use: { serviceWorkers: 'block', trace: 'retain-on-failure' },
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'webkit', use: { browserName: 'webkit', launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : undefined } },
  ],
})
