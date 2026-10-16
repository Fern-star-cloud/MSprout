import { test, expect, type Page, type TestInfo, type Locator } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { startCompatibilityServer, loadBuild } from '../../../../scripts/compatibility/server.mjs'
import { deviceRecords, expectNoSeriousAccessibilityIssues } from '../support'

// Real frozen assets, WebCrypto and candidate HTTP kernel/domain/DB. The bridge
// uses designated synthetic authorization; real cookie/CSRF/TCP proof is separate.
// No installed upgrade, actual Late row or deployed interoperability claim.
function probe() {
  const child = spawn('docker', ['exec', '-i', '-e', 'APP_ENV=testing', '-e', 'DB_HOST=127.0.0.1', '-e', 'B3_BROWSER_PROBE=isolated', '-w', '/work', process.env.COMPAT_B3_API_CONTAINER!, 'php', '-d', 'display_errors=stderr', 'tests/Support/CompatibilityBrowserProbe.php'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  let pending: { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void } | undefined
  const lines = createInterface({ input: child.stdout })
  lines.on('line', line => {
    const waiting = pending; pending = undefined
    if (!waiting) return
    try {
      const value = JSON.parse(line)
      if (value.probe_error) waiting.reject(Error('Isolated API probe failed: ' + value.probe_error + '; phase=' + value.phase + '; status=' + value.status + '; source=' + value.location))
      else waiting.resolve(value)
    } catch { waiting.reject(Error('Isolated API probe returned an invalid result')) }
  })
  child.stderr.resume() // Never persist credentials, request bodies or raw exception output.
  child.on('exit', () => { pending?.reject(Error('Isolated API probe exited')); pending = undefined })
  return {
    call(value: unknown): Promise<Record<string, unknown>> {
      if (pending) throw Error('Serialize the isolated probe')
      return new Promise((resolve, reject) => { pending = { resolve, reject }; child.stdin.write(JSON.stringify(value) + '\n') })
    },
    close() { child.stdin.end(JSON.stringify({ command: 'close' }) + '\n'); lines.close() },
  }
}

for (const build of ['legacy', 'b2', 'candidate']) for (const mode of ['blocked', 'compatible']) for (const width of build === 'candidate' ? [320, 390, 768, 1440] : [390]) for (const layout of build === 'candidate' && mode === 'blocked' && width < 768
  ? [{ height: 900, text: 100 }, { height: 420, text: 100 }, { height: 900, text: 200 }, { height: 420, text: 200 }]
  : [{ height: 900, text: 100 }]) {
  const variant = layout.height === 900 && layout.text === 100 ? '' : ` height${layout.height} text${layout.text}`
  test(`${build} ${mode} actual queued requests at ${width}px${variant}`, async ({ page, context }, info) => {
    const legacy = resolve(info.config.rootDir, '../../../../.git/msprout-compat-b1-20261016/frozen-01/manifest.json')
    const path = build === 'legacy' ? legacy : build === 'b2'
      ? resolve(info.config.rootDir, '../../../../.git/msprout-compat-b2-20261016/candidate-final/manifest.json') : resolve(process.env.COMPAT_B3_CANDIDATE!)
    const candidate = JSON.parse(readFileSync(path, 'utf8'))
    if (build === 'candidate') expect(candidate.sourceKind).toBe('B3-uncommitted-candidate')
    const { manifest } = loadBuild(path, candidate.sourceSha)
    const server = await startCompatibilityServer({ manifestPath: legacy })
    if (build !== 'legacy') server.substitute(path, candidate.sourceSha)
    const api = probe()
    let initialized = false, before: Awaited<ReturnType<typeof deviceRecords>> | undefined, pushes = 0, pulled = 0
    const external: string[] = []
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === server.origin) return route.continue()
      external.push(new URL(route.request().url()).origin); return route.abort('blockedbyclient')
    })
    await context.route('**/api/sync-conflicts', route => route.fulfill({ json: { needs_owner_review: false } }))
    // This is an already-synthetic verification read, not an authorization probe.
    // WebKit's continued fixture request stalled before any upload in the saved
    // desktop trace. Fulfill the exact origin fixture without that transport hop.
    const ministries = await (await page.request.get(server.origin + '/api/ministries')).json()
    expect(ministries.data[0].id).toBe('00000000-0000-4000-8000-000000000020')
    await context.route('**/api/ministries', route => route.fulfill({ json: ministries }))
    await context.route(/\/api\/sync\/(push|pull)(?:\?|$)/, async route => {
      const request = route.request(), headers = request.headers(), url = new URL(request.url())
      expect(headers['x-msprout-attendance-reader']).toBe(build === 'candidate' ? 'three-state-v1' : undefined)
      const projection = { path: url.pathname + url.search, headers, ...(request.method() === 'POST' ? { body: request.postDataJSON() } : {}) }
      if (request.method() === 'POST') {
        pushes++
        expect(projection.body.events).toHaveLength(3)
        if (!initialized) {
          const result = await api.call({ command: 'initialize', request: projection, mode })
          expect(result).toMatchObject({ initialized: true, realAcceptedReceipts: 1 }); initialized = true
        }
        before = await deviceRecords(page)
      } else pulled++
      const result = await api.call({ command: 'request', request: projection })
      if (mode === 'blocked') expect(result).toMatchObject({ status: 409, unchanged: true, body: { code: 'attendance_compatibility_required' } })
      else expect(result.status).toBe(200)
      await route.fulfill({ status: Number(result.status), json: result.body })
    })
    try {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(server.origin + '/profiles?church=00000000-0000-4000-8000-000000000010')
      const asset = Object.keys(manifest.assetHashes).find(name => /^assets\/index-.*\.js$/.test(name))!
      expect(createHash('sha256').update(await (await page.request.get(server.origin + '/' + asset)).body()).digest('hex')).toBe(manifest.assetHashes[asset])
      await page.getByRole('link', { name: 'Prepare this device', exact: true }).click()
      await page.getByRole('button', { name: 'Continue to local PIN' }).click()
      await page.getByLabel('Choose a 6–12 digit local PIN').fill('184629')
      await page.getByLabel('Confirm local PIN', { exact: true }).fill('184629')
      await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
      await expect(page.getByRole('button', { name: 'Open Attendance' })).toBeVisible({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Open Attendance' }).click()
      await page.getByRole('button', { name: 'Start attendance' }).click()
      for (const name of ['Mark B1 Student 1 present', 'Mark B1 Student 2 absent']) {
        await page.getByRole('button', { name }).click(); await expect(page.getByRole('button', { name })).toBeEnabled()
      }
      expect((await deviceRecords(page)).outboxEvents).toHaveLength(3)
      await page.goto(server.origin + '/account/sync')
      await page.getByLabel('Existing local PIN', { exact: true }).fill('184629')
      await page.getByRole('button', { name: 'Unlock existing profile', exact: true }).click()
      const uploadResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/sync/push' && response.request().method() === 'POST')
      await page.getByRole('button', { name: 'Continue synchronization', exact: true }).click()
      expect((await uploadResponse).status()).toBe(mode === 'blocked' ? 409 : 200)
      if (mode === 'blocked') {
        const alert = page.getByRole('alert')
        await expect(alert).toContainText(build === 'candidate' ? 'saved local attendance must be preserved' : 'Synchronization incomplete')
        expect(await deviceRecords(page)).toEqual(before)
        expect(before!.attendanceDrafts).toHaveLength(1); expect(before!.outboxEvents).toHaveLength(3)
        await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toHaveCount(0)
        const replay = await api.call({ command: 'replay' })
        expect(replay).toMatchObject({ status: 200, unchanged: true, body: { results: [{ status: 'duplicate', original_status: 'accepted' }] } })
        await page.getByRole('button', { name: 'Continue synchronization', exact: true }).focus()
        await expect(page.getByRole('button', { name: 'Continue synchronization', exact: true })).toBeFocused()
        expect(pulled).toBe(0)
      } else {
        await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toBeVisible()
        const after = await deviceRecords(page)
        expect(after.outboxEvents).toHaveLength(0); expect(after.profiles[0].syncNeedsPull).toBe(false)
        expect(pulled).toBeGreaterThan(0)
      }
      expect(pushes).toBe(1); expect(external).toEqual([])
      await expectNoSeriousAccessibilityIssues(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`${build}-${mode}-${width}.png`), fullPage: true })
      if (build === 'candidate' && mode === 'blocked') {
        await qualifyRefusalLayout(page, info, width, layout)
        expect(await deviceRecords(page)).toEqual(before)
        expect(pushes).toBe(1); expect(pulled).toBe(0)
      }
      await info.attach('qualification-scope', { body: JSON.stringify({ build, mode, width, source: manifest.sourceSha, assetHash: manifest.assetHashes[asset], actualHttpKernel: true, authorization: 'designated isolated test actor', syntheticUnsupportedConflict: mode === 'blocked', installedUpgrade: 'NOT TESTED', realLatePersistence: 'NOT TESTED' }), contentType: 'application/json' })
    } finally { api.close(); await server.stop() }
  })
}

async function qualifyRefusalLayout(page: Page, info: TestInfo, width: number, layout: { height: number; text: number }) {
  const phone = width < 768
  const geometry: unknown[] = []
  async function settled() {
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))))
  }
  async function visible(control: Locator) {
    await settled()
    await expect.poll(() => control.evaluate(element => {
      const rect = element.getBoundingClientRect(), css = getComputedStyle(element)
      const outline = document.activeElement === element ? parseFloat(css.outlineWidth) + Math.max(0, parseFloat(css.outlineOffset)) : 0
      const viewport = visualViewport, top = viewport?.offsetTop ?? 0
      const nav = document.querySelector('.phone-navigation')?.getBoundingClientRect()
      const bottom = Math.min(top + (viewport?.height ?? innerHeight), nav?.height ? nav.top : Infinity)
      return rect.top - outline >= top && rect.bottom + outline <= bottom
    })).toBe(true)
  }
  async function scrollToRead(control: Locator) {
    await control.evaluate(element => window.scrollBy({ top: element.getBoundingClientRect().top - (visualViewport?.offsetTop ?? 0) - 8, behavior: 'instant' }))
    await visible(control)
  }
  {
    const { text, height } = layout
    await page.setViewportSize({ width, height })
    await page.evaluate(text => { document.documentElement.style.fontSize = text === 200 ? '200%' : '' }, text)
    await page.evaluate(() => document.fonts.ready)
    await page.mouse.move(0, 0) // Compare layout with the same pointer/hover state.
    await page.evaluate(() => scrollTo(0, 0)); await settled()
    const name = `refusal-${width}-${height}-text${text}`
    const measured = await page.locator('.sync-screen').evaluate(root => ({
      viewport: { width: innerWidth, height: innerHeight, visualTop: visualViewport?.offsetTop, visualHeight: visualViewport?.height },
      scroll: { y: scrollY, height: document.scrollingElement?.scrollHeight, owner: document.scrollingElement?.tagName },
      contentPadding: getComputedStyle(document.querySelector('.application-content')!).paddingBottom,
      rects: Object.fromEntries(['.sync-profile-choice', '.sync-unlock-state', '.sync-stages', '.sync-stage', '.sync-actions', '.sync-tools', '.ui-error-summary', '.sync-guidance', '.phone-navigation'].map(selector => [selector, (root.querySelector(selector) ?? document.querySelector(selector))?.getBoundingClientRect().toJSON()])),
      tiles: [...root.querySelectorAll('.sync-stage')].map(element => element.getBoundingClientRect().toJSON()),
    }))
    geometry.push({ name, measured })
    await info.attach(name + '-geometry', { body: JSON.stringify(measured), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath(name + '-viewport.png') })
    await page.screenshot({ path: info.outputPath(name + '-full.png'), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 320 || text === 200) {
      expect.soft(measured.rects['.sync-unlock-state']!.top).toBeGreaterThanOrEqual(measured.rects['.sync-profile-choice']!.bottom)
      expect.soft(measured.tiles[1].top).toBeGreaterThanOrEqual(measured.tiles[0].bottom)
    }
    const controls = [page.getByRole('combobox', { name: 'Existing device profile' }), page.getByRole('button', { name: 'Continue synchronization', exact: true }), page.getByRole('button', { name: 'Lock profile', exact: true }), page.getByRole('button', { name: 'Verify account access', exact: true }), page.getByRole('button', { name: 'Check device status', exact: true }), page.locator('.sync-guidance summary')]
    for (const control of controls) {
      const rect = await control.boundingBox(); expect(rect!.width).toBeGreaterThanOrEqual(44); expect(rect!.height).toBeGreaterThanOrEqual(44)
    }
    if (phone) {
      await controls[0].focus(); await visible(controls[0])
      for (const control of controls.slice(1)) { await page.keyboard.press('Tab'); await expect(control).toBeFocused(); await visible(control) }
      for (const control of controls.slice(0, -1).reverse()) { await page.keyboard.press('Shift+Tab'); await expect(control).toBeFocused(); await visible(control) }
      // Ordinary scrolling must not be pulled back to the still-focused selector.
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await settled()
      const manualY = await page.evaluate(() => scrollY)
      await settled(); expect(await page.evaluate(() => scrollY)).toBe(manualY)
      await scrollToRead(page.locator('.sync-guidance summary'))
      await page.locator('.sync-guidance summary').click()
      await expect(page.locator('.sync-guidance')).toHaveAttribute('open', '')
      for (const paragraph of await page.locator('.sync-screen > .ui-error-summary p, .sync-guidance p').all()) {
        // At 200% a paragraph may exceed the usable height. Read every line by
        // normal scrolling rather than demanding an impossible whole-card fit.
        const lines = await paragraph.evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); return [...range.getClientRects()].map(rect => ({ top: rect.top + scrollY, height: rect.height })) })
        for (const line of lines) {
          await page.evaluate(y => scrollTo(0, y - (visualViewport?.offsetTop ?? 0) - 8), line.top); await settled()
          const bounds = await page.evaluate(() => ({ top: visualViewport?.offsetTop ?? 0, bottom: Math.min((visualViewport?.offsetTop ?? 0) + (visualViewport?.height ?? innerHeight), document.querySelector('.phone-navigation')!.getBoundingClientRect().top), scroll: scrollY }))
          expect(line.top - bounds.scroll).toBeGreaterThanOrEqual(bounds.top)
          expect(line.top + line.height - bounds.scroll).toBeLessThanOrEqual(bounds.bottom)
        }
      }
      for (const link of await page.locator('.sync-guidance a').all()) { await scrollToRead(link); await link.focus(); await visible(link) }
      await page.locator('.sync-guidance summary').focus(); await visible(page.locator('.sync-guidance summary'))
      await page.keyboard.press('Enter'); await expect(page.locator('.sync-guidance')).not.toHaveAttribute('open', '')
      await page.getByRole('alert').evaluate(element => window.scrollBy({ top: element.getBoundingClientRect().top - (visualViewport?.offsetTop ?? 0) - 8, behavior: 'instant' })); await settled()
      await page.screenshot({ path: info.outputPath(name + '-alert-viewport.png') })
    }
    await expectNoSeriousAccessibilityIssues(page)
  }
  await info.attach('refusal-layout-matrix', { body: JSON.stringify(geometry), contentType: 'application/json' })
}
