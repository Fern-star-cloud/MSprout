import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import config from '../../vite.config'

const manifest = JSON.parse(readFileSync(resolve('public/manifest.webmanifest'), 'utf8')) as { name: string; short_name: string; theme_color: string; background_color: string; icons: { src: string; purpose: string }[] }
const html = readFileSync(resolve('index.html'), 'utf8')
const tokens = readFileSync(resolve('src/styles/tokens.css'), 'utf8')
it('uses the approved MSprout display name and real approved raster exports', () => {
  expect(manifest.name).toBe('MSprout'); expect(manifest.short_name).toBe('MSprout')
  for (const icon of manifest.icons) expect(existsSync(resolve('public', '.' + icon.src))).toBe(true)
  // Approval covers this raster identity, not a maskable export qualification.
  expect(manifest.icons.every(icon => icon.purpose === 'any')).toBe(true)
})
it('aligns production theme and splash background metadata with the shared navy and canvas', () => {
  const navy = tokens.match(/--color-navy:\s*(#[0-9a-f]+)/)![1]
  const canvas = tokens.match(/--color-canvas:\s*(#[0-9a-f]+)/)![1]
  expect(manifest.theme_color).toBe(navy); expect(manifest.background_color).toBe(canvas)
  expect(html).toContain(`name="theme-color" content="${navy}"`)
})
it('references real approved notification icons without an absent substitute', () => {
  const source = readFileSync(resolve('src/pwa/service-worker.ts'), 'utf8')
  const references = [...source.matchAll(/(?:icon|badge):\s*'([^']+)'/g)].map(match => match[1])
  expect(references).toHaveLength(2)
  for (const reference of references) expect(existsSync(resolve('public', '.' + reference))).toBe(true)
})
it('pre-caches the manifest and retained icons alongside the production shell only', () => {
  // Inspect the actual plugin option supplied to Workbox, rather than a fixture manifest.
  const plugin = config.plugins?.flat().find(value => value && 'name' in value && value.name === 'vite-plugin-pwa')
  expect(plugin).toBeDefined()
  const source = readFileSync(resolve('vite.config.ts'), 'utf8')
  expect(source).toContain("'manifest.webmanifest'"); expect(source).toContain("'icons/sprout-*.svg'")
  expect(source).toContain("'icons/msprout-*.png'"); expect(source).toContain("'brand/*.{svg,png}'")
})
