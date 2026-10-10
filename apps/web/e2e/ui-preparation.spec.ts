import { expect, test, type Page } from '@playwright/test'
import { bootstrap, churchId, expectNoSeriousAccessibilityIssues, json, ministryId, mockCsrf, otherChurchId } from './support'

test.use({ serviceWorkers: 'block' })
let actor: number, role: 'teacher' | 'owner', assigned: string[], currentMfa: boolean, expired: boolean
test.beforeEach(async ({ context }) => {
  actor = 11; role = 'teacher'; assigned = [ministryId]; currentMfa = false; expired = false
  await mockCsrf(context)
  await context.route('**/logout', route => route.fulfill({ status: 204 }))
  await context.route('**/api/**', route => json(route, {}, 503))
  await context.route('**/auth/**', route => json(route, {}, 503))
  await context.route('**/auth/session', route => json(route, { id: actor, email_verified: true, mfa_confirmed: currentMfa, workspaces: [{ church_id: churchId, name: 'Synthetic church', role }] }, expired ? 401 : 200))
  await context.route('**/api/me', route => json(route, { id: actor, email_verified: true, active_session: { mfa_confirmed: currentMfa }, memberships: [{ church_id: churchId, role, status: 'active' }], assignments: { ministry_ids: assigned } }, expired ? 401 : 200))
  await context.route('**/api/ministries', route => json(route, { data: [{ id: ministryId, name: 'Authorized ministry', status: 'active', version: 1 }, { id: '00000000-0000-4000-8000-000000000021', name: 'Other ministry', status: 'active', version: 1 }] }))
  await context.route('**/api/offline/bootstrap**', route => {
    const value = bootstrap(String(actor), undefined, new URL(route.request().url()).searchParams.get('device_id')!)
    if (role === 'owner') value.ministries.push({ id: '00000000-0000-4000-8000-000000000021', name: 'Other ministry', version: 1 })
    return json(route, value)
  })
})
async function pinStage(page: Page) {
  await page.goto('/account/prepare')
  await page.getByRole('button', { name: 'Continue to local PIN' }).click()
}
async function submit(page: Page, pin = '000123') {
  await page.getByLabel('Choose a 6–12 digit local PIN').fill(pin)
  await page.getByLabel('Confirm local PIN').fill(pin)
  await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
}
async function rows(page: Page) {
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

test('three accessible stages save encrypted data with no attendance; leading-zero PIN survives locking', async ({ page }) => {
  await page.goto('/account/prepare'); await expect(page.getByText('Authorized ministry', { exact: true })).toBeVisible()
  await expect(page.getByText('Other ministry', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Church ID')).toHaveCount(0)
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expectNoSeriousAccessibilityIssues(page)
    await page.screenshot({ path: test.info().outputPath(`preparation-access-${width}.png`), fullPage: true })
  }
  await page.getByRole('button', { name: 'Continue to local PIN' }).click()
  await expect(page.getByRole('heading', { name: '2. Protect this device profile' })).toBeFocused()
  await page.getByLabel('Choose a 6–12 digit local PIN').fill('000123'); await page.getByLabel('Confirm local PIN').fill('000124')
  await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
  await expect(page.getByRole('alert')).toContainText('Check the local PIN')
  await expect(page.getByLabel('Choose a 6–12 digit local PIN')).toHaveAttribute('aria-invalid', 'true')
  await expectNoSeriousAccessibilityIssues(page)
  await submit(page); await expect(page.getByRole('heading', { name: 'Ready for offline attendance' })).toBeVisible()
  const data = await rows(page)
  expect(data.find(item => item.table === 'profiles')!.rows).toHaveLength(1)
  expect(data.find(item => item.table === 'encryptedBlobs')!.rows).toHaveLength(3)
  expect(data.find(item => item.table === 'attendanceDrafts')!.rows).toHaveLength(0)
  expect(data.find(item => item.table === 'outboxEvents')!.rows).toHaveLength(0)
  expect(JSON.stringify(data)).not.toMatch(/Pilot Student|000123|"roster":/)
  await expect(page.getByRole('heading', { name: 'Take attendance' })).toHaveCount(0)
  await expectNoSeriousAccessibilityIssues(page)
  await page.getByRole('button', { name: 'Lock profile', exact: true }).click()
  const tree = await page.locator('body').ariaSnapshot()
  expect(tree).not.toMatch(/Pilot Student|Ready for offline attendance|Authorized ministry/)
  await page.getByRole('link', { name: 'Device profiles and safe recovery' }).click()
  await page.getByLabel('Local PIN', { exact: true }).fill('000123')
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await expect(page.getByText('Pilot Student A')).toBeVisible()
})

test('Owner requires current-session MFA and then receives authorized church scope', async ({ page }) => {
  role = 'owner'; assigned = []
  await page.goto('/account/prepare'); await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue to local PIN' })).toHaveCount(0)
  currentMfa = true; await page.getByRole('button', { name: 'Verify access again' }).click()
  await expect(page.getByText('Other ministry', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue to local PIN' }).click(); await submit(page)
  await expect(page.getByRole('heading', { name: 'Ready for offline attendance' })).toBeVisible()
})

test('no assignments, unverified church and expired session never create a profile', async ({ page }) => {
  assigned = []; await page.goto('/account/prepare')
  await expect(page.getByText(/No authorized active ministries/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue to local PIN' })).toBeDisabled()
  expect((await rows(page)).find(item => item.table === 'profiles')!.rows).toHaveLength(0)
  await page.goto(`/account/prepare?church=${otherChurchId}`); await expect(page.getByRole('alert')).toBeVisible()
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/Authorized ministry|Pilot Student/)
  expired = true; await page.goto('/account/prepare'); await expect(page.getByRole('alert')).toBeVisible()
  expect((await rows(page)).find(item => item.table === 'profiles')!.rows).toHaveLength(0)
})

test('durable-write failure retains the original partial key and resumes after reload without recreation', async ({ page }) => {
  await pinStage(page)
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'encryptedBlobs') throw new DOMException('Synthetic quota failure', 'QuotaExceededError')
      return original.apply(this, args as Parameters<IDBObjectStore['put']>)
    }
  })
  await submit(page); await expect(page.getByRole('alert')).toContainText('Keep this profile and its existing PIN')
  const before = (await rows(page)).find(item => item.table === 'profiles')!.rows[0]
  await page.reload()
  await page.getByRole('radio', { name: 'Continue Profile 1' }).check()
  await page.getByRole('button', { name: 'Continue to local PIN' }).click()
  await page.getByLabel('Existing local PIN').fill('000123')
  await page.getByRole('button', { name: 'Continue encrypted preparation' }).click()
  await expect(page.getByRole('heading', { name: 'Ready for offline attendance' })).toBeVisible()
  const after = await rows(page), profile = after.find(item => item.table === 'profiles')!.rows
  expect(profile).toHaveLength(1); expect(profile[0].id).toBe(before.id); expect(profile[0].deviceId).toBe(before.deviceId)
  expect(profile[0].wrappedDataKey).toEqual(before.wrappedDataKey)
  expect(after.find(item => item.table === 'attendanceDrafts')!.rows).toHaveLength(0)
  expect(after.find(item => item.table === 'outboxEvents')!.rows).toHaveLength(0)
  await expectNoSeriousAccessibilityIssues(page)
})

test('authorization loss during download suppresses stale success and keeps the partial profile', async ({ page, context }) => {
  let release!: () => void
  await context.route('**/api/offline/bootstrap**', async route => {
    await new Promise<void>(resolve => { release = resolve })
    return json(route, bootstrap('11', undefined, new URL(route.request().url()).searchParams.get('device_id')!))
  })
  await pinStage(page); await submit(page); await expect.poll(() => !!release).toBe(true)
  await page.evaluate(() => globalThis.dispatchEvent(new CustomEvent('church-workspace-invalidated', { detail: { status: 401 } })))
  release(); await expect(page.getByRole('alert')).toContainText('Keep this profile')
  await expect(page.getByRole('button', { name: 'Verify access again' })).toBeVisible()
  const data = await rows(page)
  expect(data.find(item => item.table === 'profiles')!.rows).toHaveLength(1)
  expect(data.find(item => item.table === 'encryptedBlobs')!.rows).toHaveLength(0)
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/Pilot Student|Authorized ministry|Ready for offline attendance/)
})

test('offline preparation clears secrets and remains unavailable without disturbing an existing encrypted profile', async ({ page, context }) => {
  await pinStage(page); await submit(page); await expect(page.getByRole('heading', { name: 'Ready for offline attendance' })).toBeVisible()
  const before = await rows(page)
  await context.setOffline(true)
  await page.evaluate(() => globalThis.dispatchEvent(new Event('offline')))
  await expect(page.getByRole('heading', { name: 'Ready for offline attendance' })).toHaveCount(0)
  expect(await rows(page)).toEqual(before)
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/Pilot Student|Authorized ministry/)
  await expectNoSeriousAccessibilityIssues(page)
})
