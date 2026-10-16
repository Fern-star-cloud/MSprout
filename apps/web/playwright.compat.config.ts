import { defineConfig } from '@playwright/test'
import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.env.COMPAT_B1_MANIFEST || !process.env.COMPAT_B1_OUTPUT) throw Error('Set the isolated frozen manifest and evidence directory')
const allowed = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../.git/msprout-compat-b1-20261016'))
const output = resolve(process.env.COMPAT_B1_OUTPUT)
const distance = relative(allowed, output)
if (!distance || distance.startsWith('..') || isAbsolute(distance) || dirname(output) !== allowed) throw Error('Output must be a new directory inside ignored B1 resources')
// Workers reload this config after their parent has created runner output.
// Only the coordinator may authorize a fresh output directory.
if (process.env.TEST_WORKER_INDEX === undefined && existsSync(output) && (realpathSync(output) !== output || readdirSync(output).length)) throw Error('Never reuse or erase prior browser evidence/storage')
export default defineConfig({
  testDir: './e2e/compatibility', testMatch: 'legacy.spec.ts', fullyParallel: false,
  workers: 1, retries: 0, timeout: 90_000,
  outputDir: process.env.COMPAT_B1_OUTPUT,
  reporter: [['list'], ['json', { outputFile: `${process.env.COMPAT_B1_OUTPUT}/results.json` }]],
  projects: [{ name: 'chrome', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
})
