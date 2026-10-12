import { expect, test as base, type Page } from '@playwright/test'
import { addProfile, deviceRecords, expectNoSeriousAccessibilityIssues, mockCsrf } from './support'
import { startPwaServer } from './pwa-server'

const test = base.extend<object, { pwaOrigin: string }>({
  pwaOrigin: [async ({ browserName }, provide) => {
    if (!browserName) throw new Error('Qualification requires an isolated browser')
    const server = await startPwaServer()
    try { await provide(server.origin) } finally { await server.stop() }
  }, { scope: 'worker' }],
  baseURL: async ({ pwaOrigin }, provide) => { await provide(pwaOrigin) },
})

// Run against the isolated production-output server, with real service workers.
async function controlled(page: Page) {
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
}
async function version(page: Page) {
  return page.evaluate(async () => {
    const channel = new MessageChannel()
    const response = new Promise<number>(resolve => { channel.port1.onmessage = event => { channel.port1.close(); resolve(event.data) } })
    navigator.serviceWorker.controller!.postMessage('UI15_VERSION', [channel.port2])
    return response
  })
}
async function announce(page: Page) {
  const revision = (await (await page.request.post('/__qa/revision')).json()).revision as number
  await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update() })
  await expect(page.getByRole('region', { name: 'Application update' })).toBeVisible()
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).waiting?.state)).toBe('installed')
  return revision
}
test('production manifest, favicon and retained SVG icons decode and remain available offline', async ({ page, context, browserName }) => {
  await page.goto('/'); await controlled(page)
  await expect(page.getByRole('heading', { name: 'Choose a device profile' })).toBeVisible()
  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json())
  expect(manifest).toMatchObject({ name: 'MinistrySprout', short_name: 'MSprout', start_url: '/', scope: '/', display: 'standalone', theme_color: '#102c46', background_color: '#f1f6fc' })
  expect(manifest.icons.every((icon: { purpose: string }) => icon.purpose === 'any')).toBe(true)
  expect(await page.locator('meta[name=theme-color]').getAttribute('content')).toBe(manifest.theme_color)
  expect(new URL(page.url()).pathname).toBe(manifest.start_url)
  const favicon = await page.locator('link[rel=icon]').getAttribute('href')
  expect(favicon).toBe('/icons/sprout-192.svg')
  for (const link of await page.locator('footer a').all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  for (const icon of manifest.icons) {
    expect(await page.evaluate(async (src: string) => {
      const response = await fetch(src); if (!response.ok || !response.headers.get('content-type')?.includes('image/svg+xml')) return false
      const image = new Image(); image.src = src; await image.decode(); return image.naturalWidth > 0 && image.naturalHeight > 0
    }, icon.src)).toBe(true)
  }
  const mask = await page.evaluate(async () => {
    const image = new Image(); image.src = '/icons/sprout-512.svg'; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512
    const draw = canvas.getContext('2d')!; draw.drawImage(image, 0, 0, 512, 512)
    const pixels = draw.getImageData(0, 0, 512, 512).data; let whiteOutsideSafeCircle = 0
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const index = (y * 512 + x) * 4
      if (Math.hypot(x - 256, y - 256) > 204.8 && pixels[index] > 240 && pixels[index + 1] > 240 && pixels[index + 2] > 240 && pixels[index + 3] > 240) whiteOutsideSafeCircle++
    }
    return { whiteOutsideSafeCircle, productionA2AssetQualification: 'conditional' }
  })
  await test.info().attach('retained-icon-mask-diagnostic', { body: JSON.stringify(mask), contentType: 'application/json' })
  // An unreachable origin proves that real cached responses need no network.
  // WebKit's setOffline flag itself rejects worker responses (upstream42775).
  await page.request.post('/__qa/network-down')
  try {
  expect(await page.evaluate(async () => { try { await fetch('/api/__qa-uncached'); return true } catch { return false } })).toBe(false)
  if (browserName !== 'webkit') await context.setOffline(true)
  for (const src of ['/manifest.webmanifest', ...manifest.icons.map((icon: { src: string }) => icon.src)]) {
    const result = await page.evaluate(async url => {
      try { return { ok: (await fetch(url)).ok } } catch {
        const entries = (await Promise.all((await caches.keys()).map(async name => (await (await caches.open(name)).keys()).map(request => request.url)))).flat()
        return { ok: false, requested: url, cached: entries.map(value => new URL(value).pathname + new URL(value).search) }
      }
    }, src)
    expect(result.ok, JSON.stringify(result)).toBe(true)
  }
  const reload = await page.reload()
  expect(reload?.status()).toBe(200); expect(reload?.fromServiceWorker()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Choose a device profile' })).toBeVisible()
  // navigator.onLine is a browser hint, not a server-readiness measurement.
  await expect(page.getByRole('status').filter({ hasText: browserName === 'webkit' ? 'Online' : 'Offline' })).toBeVisible()
  const cachePaths = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async name => (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname)))).flat())
  expect(cachePaths.some(path => /^\/(api|platform|auth|sanctum|health)(\/|$)/.test(path))).toBe(false)
  await page.screenshot({ path: test.info().outputPath('offline-profile-entry.png'), fullPage: true })
  } finally {
    await context.setOffline(false)
    await page.request.post('/__qa/network-up')
  }
})
test('protected endpoint navigation and fetches never become cached application-shell successes', async ({ page, context }) => {
  await page.goto('/profiles'); await controlled(page)
  for (const prefix of ['api', 'platform', 'auth', 'sanctum', 'health']) {
    for (const path of [`/${prefix}`, `/${prefix}?probe=1`, `/${prefix}/__qa-probe?probe=1`, `/%${prefix.charCodeAt(0).toString(16)}${prefix.slice(1)}?probe=1`, `/${prefix}%2f__qa-probe`, `/safe/%252e%252e/${prefix}`, `/safe/%2e%2e/${prefix}`]) {
      expect(await page.evaluate(async url => (await fetch(url)).status, path)).toBe(503)
      const result = await page.goto(path); expect(result?.status()).toBe(503)
      expect(await page.locator('link[rel=manifest]').count()).toBe(0)
      await page.goto('/profiles'); await controlled(page)
    }
  }
  await context.setOffline(true)
  expect(await page.evaluate(async () => { try { return (await fetch('/platform/__qa-probe')).ok } catch { return false } })).toBe(false)
})
test('a real waiting worker remains deferred with exact encrypted pending-work preservation on locked entry', async ({ page, context }) => {
  await mockCsrf(context)
  await addProfile(page)
  await page.getByRole('button', { name: 'Mark Pilot Student A present' }).click()
  await expect(page.getByRole('button', { name: 'Mark Pilot Student A present' })).toBeEnabled()
  await page.goto('/profiles'); await controlled(page)
  const before = await deviceRecords(page); expect(before.outboxEvents.length).toBeGreaterThan(0)
  const old = await version(page)
  await announce(page)
  await page.getByRole('button', { name: 'Update when safe' }).dblclick()
  await expect(page.getByRole('status').filter({ hasText: 'Safe updating is not available' })).toBeVisible()
  const updateAction = page.getByRole('button', { name: 'Update when safe' })
  await updateAction.focus(); await page.keyboard.press('Enter')
  await expect(updateAction).toBeEnabled(); await expect(updateAction).toBeFocused()
  expect(await version(page)).toBe(old)
  expect(await deviceRecords(page)).toEqual(before)
  // Generic removal instructions may name kinds of work; they disclose no actual records.
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/Pilot Student|Primary|attendanceDrafts/)
  expect(await page.getByRole('region', { name: 'Application update' }).ariaSnapshot()).not.toMatch(/pending uploads|attendance|student|profile/i)
  await expectNoSeriousAccessibilityIssues(page)
  await page.screenshot({ path: test.info().outputPath('privacy-safe-deferred-update.png'), fullPage: true })
})
test('public and Platform account show a deliberate real update without claiming account authority', async ({ page }) => {
  await page.goto('/profiles'); await controlled(page)
  const revision = await announce(page)
  await page.getByRole('link', { name: 'Platform administration', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Application update' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Applications', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Update when safe' }).click()
  await expect.poll(() => version(page)).toBe(revision)
  await expect(page.getByRole('region', { name: 'Application update' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Applications', exact: true })).toHaveCount(0)
  await expectNoSeriousAccessibilityIssues(page)
})
