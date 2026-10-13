import { expect, test, type Page } from '@playwright/test'
import { bootstrap, churchId, expectNoSeriousAccessibilityIssues, json, ministryId, mockCsrf } from './support'

test.use({ serviceWorkers: 'block' })
let actor: string, deviceId: string
test.beforeEach(async ({ context }) => {
  actor = '11'; deviceId = ''
  await mockCsrf(context)
  await context.route('**/auth/session', route => json(route, { id: Number(actor), email_verified: true, mfa_confirmed: false, workspaces: [{ church_id: churchId, name: 'Synthetic church', role: 'teacher' }] }))
  await context.route('**/api/me', route => json(route, { id: Number(actor), email_verified: true, memberships: [{ church_id: churchId, status: 'active', role: 'teacher' }], active_session: { mfa_confirmed: false }, assignments: { ministry_ids: [ministryId] } }))
  await context.route('**/api/ministries', route => json(route, { data: [{ id: ministryId, name: 'Authorized ministry', status: 'active', version: 1 }] }))
  await context.route('**/api/offline/bootstrap**', route => {
    deviceId = new URL(route.request().url()).searchParams.get('device_id')!
    return json(route, bootstrap(actor, [], deviceId))
  })
  await context.route('**/api/sync/pull**', route => json(route, { changes: [], page: { next_cursor: '0', has_more: false }, lease: bootstrap(actor, [], deviceId).lease }))
  await context.route('**/logout', route => route.fulfill({ status: 204 }))
})

async function prepare(page: Page) {
  await page.goto('/account/prepare')
  await page.getByRole('button', { name: 'Continue to local PIN' }).click()
  await page.getByLabel('Choose a 6–12 digit local PIN').fill('000123')
  await page.getByLabel('Confirm local PIN').fill('000123')
  await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
  await expect(page.getByRole('heading', { name: 'Ready for offline attendance' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Lock profile' }).click()
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('ministry-sprout-offline')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try {
      const tables = [...db.objectStoreNames], tx = db.transaction(tables)
      return await Promise.all(tables.map(table => new Promise<{ table: string; rows: Record<string, unknown>[] }>((resolve, reject) => {
        const read = tx.objectStore(table).getAll(); read.onsuccess = () => resolve({ table, rows: read.result }); read.onerror = () => reject(read.error)
      })))
    } finally { db.close() }
  })
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true })
  const css = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, items: [...document.querySelectorAll('.device-entry-frame,.device-entry-header,.device-entry-rail,.device-profiles,.profile-picker-row,.profile-pin-heading h2,.profile-pin-form input,.profile-pin-form > button,.ui-dialog[open],.device-preparation,.preparation-steps')].filter(el => el.getClientRects().length).map(el => {
    const b = el.getBoundingClientRect(), s = getComputedStyle(el)
    return { selector: el.className || el.tagName, x: b.x, y: b.y, width: b.width, height: b.height, font: s.fontFamily, size: s.fontSize, lineHeight: s.lineHeight, color: s.color, background: s.backgroundColor, gradient: s.backgroundImage, padding: s.padding, radius: s.borderRadius, gap: s.gap }
  }) }))
  await test.info().attach(`${name}-css`, { body: JSON.stringify(css, null, 2), contentType: 'application/json' })
  expect(css.scrollWidth).toBeLessThanOrEqual(css.viewport)
}

async function expectCompactProfileHeader(page: Page, width: number) {
  if (width >= 1024) return
  const geometry = await page.locator('.device-entry-header').evaluate(header => {
    const rect = (selector: string) => {
      const b = header.querySelector(selector)!.getBoundingClientRect()
      return { x: b.x, right: b.right, center: b.y + b.height / 2, height: b.height }
    }
    return { headerHeight: header.getBoundingClientRect().height, back: rect('.profile-back'), status: rect('.device-entry-connection'), brand: rect('.device-entry-brand') }
  })
  expect(geometry.headerHeight).toBeLessThanOrEqual(62)
  expect(Math.abs(geometry.back.center - geometry.status.center)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry.brand.center - geometry.status.center)).toBeLessThanOrEqual(1)
  expect(geometry.back.right).toBeLessThanOrEqual(geometry.status.x)
  expect(geometry.status.right).toBeLessThanOrEqual(geometry.brand.x)
  expect(geometry.back.height).toBeGreaterThanOrEqual(44)
}

test('Pack02 production picker and masked PIN reflow privately at desktop tablet and phone widths', async ({ page }) => {
  await prepare(page); actor = '22'; await prepare(page)
  await page.goto('/profiles')
  const before = await snapshot(page)
  for (const width of [1440, 1024, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('heading', { name: 'Choose a device profile' })).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)
    await expect(page.locator('.connectivity-status,.device-entry-connection')).toHaveCount(1)
    await expect(page.locator('.device-entry-connection')).toBeVisible()
    await expect(page.locator('.device-entry-connection')).toHaveAttribute('role', 'status')
    await expect(page.locator('.device-entry-connection')).toHaveAttribute('aria-live', 'polite')
    await expect(page.locator('.device-entry-connection')).toHaveCSS('padding', '0px')
    await expect(page.locator('.device-entry-connection')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    expect(await page.locator('main').ariaSnapshot()).not.toMatch(/Synthetic church|Authorized ministry|church_id|actorId|pending uploads/i)
    await expect(page.getByRole('radio', { name: 'Profile 2', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Prepare this device', exact: true })).toBeVisible()
    await capture(page, `picker-${width}`)
    await expectNoSeriousAccessibilityIssues(page)
    await page.getByRole('button', { name: 'Use profile 1' }).click()
    await expect(page.getByLabel('Local PIN', { exact: true })).toBeFocused()
    await expect(page.getByLabel('Local PIN', { exact: true })).toHaveAttribute('type', 'password')
    await expect(page.getByLabel('Local PIN', { exact: true })).toHaveAttribute('inputmode', 'numeric')
    await expect(page.locator('.device-entry-connection')).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)
    await expectCompactProfileHeader(page, width)
    await capture(page, `pin-${width}`)
    await expectNoSeriousAccessibilityIssues(page)
    await page.getByRole('button', { name: '‹ Profiles', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Use profile 1' })).toBeFocused()
  }
  expect(await snapshot(page)).toEqual(before)
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await page.addStyleTag({ content: ':root { font-size: 200%; }' })
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  await capture(page, 'pin-320-enlarged')
  await expectNoSeriousAccessibilityIssues(page)
})

test('profile header connectivity and retained routes work online offline and with keyboard unlock', async ({ page, context }) => {
  await prepare(page); await page.goto('/profiles')
  const before = await snapshot(page)
  for (const width of [1440, 1024, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const status = page.locator('.device-entry-connection')
    await expect(page.locator('.connectivity-status,.device-entry-connection')).toHaveCount(1)
    await expect(status).toBeVisible()
    await expect(status).toHaveText('Browser connectivity: Online. This does not confirm server availability or signed-in access.')
    await page.getByRole('button', { name: 'Use profile 1' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Local PIN', { exact: true })).toBeFocused()
    await context.setOffline(true)
    await expect(status).toBeVisible()
    await expect(status).toContainText('Browser connectivity: Offline.')
    await expectCompactProfileHeader(page, width)
    await expect(page.getByRole('link', { name: 'Need online sign-in?' })).toHaveAttribute('href', '/account/login')
    await capture(page, `pin-offline-${width}`)
    await expectNoSeriousAccessibilityIssues(page)
    await context.setOffline(false)
    await expect(status).toContainText('Browser connectivity: Online.')
    await expectCompactProfileHeader(page, width)
    await capture(page, `pin-online-${width}`)
    await page.getByRole('button', { name: '‹ Profiles', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Use profile 1' })).toBeFocused()
  }
  expect(await snapshot(page)).toEqual(before)
  await page.getByRole('link', { name: 'Prepare this device', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/prepare$/)
  await expect(page.getByRole('button', { name: 'Continue to local PIN' })).toBeVisible()
  await page.goto('/profiles'); await page.setViewportSize({ width: 1024, height: 900 })
  await expect(page.getByRole('navigation', { name: 'Device navigation' }).getByRole('link')).toHaveCount(4)
  await page.getByRole('link', { name: 'Help', exact: true }).click()
  await expect(page.locator('#profile-help')).toHaveAttribute('open', '')
  await page.getByRole('link', { name: 'Sync & device', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/sync$/)
  await page.goto('/profiles'); await page.getByRole('button', { name: 'Use profile 1' }).click()
  await page.getByRole('link', { name: 'Need online sign-in?' }).click()
  await expect(page).toHaveURL(/\/account\/login$/)
  await expect(page.locator('.public-layout footer a')).toHaveCount(5)
  await expect(page.locator('.public-layout footer .connectivity-status')).toBeVisible()
  await page.goto('/profiles'); await page.getByRole('button', { name: 'Use profile 1' }).click()
  await page.getByLabel('Local PIN', { exact: true }).fill('000123')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/account\/attendance$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Take attendance' })).toBeVisible()
})

test('real incorrect PIN deadline, lock and blocked-removal dialog preserve every encrypted row', async ({ page }) => {
  await prepare(page); await page.goto('/profiles')
  await page.evaluate(async () => {
    const request = indexedDB.open('ministry-sprout-offline')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction('profiles', 'readwrite'), read = tx.objectStore('profiles').getAll()
    read.onsuccess = () => tx.objectStore('profiles').put({ ...read.result[0], failedAttempts: 5 })
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve() }); db.close()
  })
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await page.getByLabel('Local PIN', { exact: true }).fill('000000')
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await expect(page.getByRole('alert')).toContainText('PIN is incorrect')
  await expect(page.getByLabel('Local PIN', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Use profile 1' })).toBeDisabled()
  await capture(page, 'incorrect-pin-retry')
  await expectNoSeriousAccessibilityIssues(page)
  // Advance the browser clock past the real persisted deadline, never change retry policy.
  await page.clock.install()
  await page.clock.fastForward(33_000)
  await page.getByLabel('Local PIN', { exact: true }).fill('000123')
  await page.locator('.profile-management > summary').click()
  await page.getByRole('button', { name: 'Unlock to manage profile' }).click()
  await expect(page.getByRole('heading', { name: 'Manage Profile 1' })).toBeVisible()
  const before = await snapshot(page)
  await page.getByRole('button', { name: 'Remove selected profile' }).click()
  await expect(page.getByRole('dialog', { name: 'This profile cannot be removed' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true) }
  await capture(page, 'blocked-removal')
  await expectNoSeriousAccessibilityIssues(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Remove selected profile' })).toBeFocused()
  expect(await snapshot(page)).toEqual(before)
  await page.getByRole('button', { name: 'Lock profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile locked' })).toBeFocused()
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/pending uploads|Downloads incomplete/)
  await capture(page, 'profile-locked')
  expect(await snapshot(page)).toEqual(before)
  await page.getByRole('button', { name: 'Unlock with PIN' }).click()
  await page.getByLabel('Local PIN', { exact: true }).fill('000123')
  await page.locator('.profile-management > summary').click()
  await page.getByRole('button', { name: 'Unlock to manage profile' }).click()
  await expect(page.getByRole('heading', { name: 'Manage Profile 1' })).toBeVisible()
  await page.clock.fastForward(300_001)
  await expect(page.getByRole('heading', { name: 'Profile locked' })).toBeFocused()
  await capture(page, 'profile-locked-inactivity')
  expect(await snapshot(page)).toEqual(before)
  await page.getByRole('button', { name: 'Unlock with PIN' }).click()
  await page.getByLabel('Local PIN', { exact: true }).fill('000123')
  await page.locator('.profile-management > summary').click()
  await page.getByRole('button', { name: 'Unlock to manage profile' }).click()
  await expect(page.getByRole('heading', { name: 'Manage Profile 1' })).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
  })
  await expect(page.getByRole('heading', { name: 'Profile locked' })).toBeFocused()
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/pending uploads|Downloads incomplete/)
  await capture(page, 'profile-locked-background-signal')
  expect(await snapshot(page)).toEqual(before)
})

test('expired authorization needs online sign-in even with a correct local PIN', async ({ page, context }) => {
  await prepare(page)
  await page.goto('/profiles')
  await page.evaluate(async () => {
    const request = indexedDB.open('ministry-sprout-offline')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction('profiles', 'readwrite'), read = tx.objectStore('profiles').getAll()
    read.onsuccess = () => tx.objectStore('profiles').put({ ...read.result[0], leaseExpiresAt: '2020-01-01T00:00:00Z' })
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve() }); db.close()
  })
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await page.getByLabel('Local PIN', { exact: true }).fill('000123')
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await expect(page.getByRole('heading', { name: 'Online sign-in required' })).toBeVisible()
  await expect(page).toHaveURL(/\/profiles$/)
  await capture(page, 'online-sign-in-required')
  const before = await snapshot(page)
  await page.getByRole('button', { name: 'Lock profile' }).click()
  await page.getByRole('button', { name: 'Unlock with PIN' }).click()
  await context.setOffline(true)
  await page.getByLabel('Local PIN', { exact: true }).fill('000123')
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await expect(page.getByRole('heading', { name: 'Online sign-in required' })).toBeVisible()
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/\d+ pending uploads|Downloads complete/)
  expect(await snapshot(page)).toEqual(before)
})

test('preparation shows verified access matching PIN durable encrypted readiness and truthful unavailable state', async ({ page, context }) => {
  await page.goto('/account/prepare')
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 900 }); await capture(page, `prepare-access-${width}`); await expectNoSeriousAccessibilityIssues(page) }
  await expect(page.getByLabel('Church ID')).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue to local PIN' }).click()
  await capture(page, 'prepare-pin')
  await page.getByLabel('Choose a 6–12 digit local PIN').fill('000123')
  await page.getByLabel('Confirm local PIN').fill('000124')
  await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
  await expect(page.getByRole('alert')).toContainText('Check the local PIN')
  await page.getByLabel('Confirm local PIN').fill('000123')
  await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
  await expect(page.getByRole('heading', { name: 'Ready for offline attendance' })).toBeVisible({ timeout: 30_000 })
  await capture(page, 'prepare-ready')
  const before = await snapshot(page)
  expect(before.find(table => table.table === 'attendanceDrafts')?.rows).toEqual([])
  expect(before.find(table => table.table === 'outboxEvents')?.rows).toEqual([])
  await context.route('**/auth/session', route => json(route, { code: 'unauthenticated' }, 401))
  await page.goto('/account/prepare')
  await expect(page.getByRole('alert')).toBeVisible()
  await capture(page, 'prepare-online-required')
  expect(await snapshot(page)).toEqual(before)
})

test('an unavailable queue count does not replace a verified lease with an online sign-in claim', async ({ page }) => {
  await prepare(page); await page.goto('/profiles')
  await page.evaluate(() => {
    const original = IDBIndex.prototype.count
    IDBIndex.prototype.count = function (...args) {
      if (this.objectStore.name === 'outboxEvents') throw new DOMException('Synthetic count read failure', 'UnknownError')
      return original.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await page.getByLabel('Local PIN', { exact: true }).fill('000123')
  await page.locator('.profile-management > summary').click()
  await page.getByRole('button', { name: 'Unlock to manage profile' }).click()
  await expect(page.getByRole('heading', { name: 'Manage Profile 1' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Pending uploads: unavailable or checking/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Online sign-in required' })).toHaveCount(0)
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/0 pending uploads/)
  await capture(page, 'queue-unavailable-verified-lease')
  const before = await snapshot(page)
  await page.getByRole('button', { name: 'Lock profile' }).click()
  expect(await snapshot(page)).toEqual(before)
})
