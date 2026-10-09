import { expect, test, type Page } from '@playwright/test'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { bootstrap, churchId, expectNoSeriousAccessibilityIssues, json, mockCsrf } from './support'

test.use({ serviceWorkers: 'block' })
let fixtureHtml: string
test.beforeAll(async () => {
  const result = await build({ configFile: false, root: path.resolve(import.meta.dirname, '..'), plugins: [react()], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error', build: { write: false, minify: false, lib: { entry: path.resolve(import.meta.dirname, 'fixtures/ui-profiles.tsx'), formats: ['iife'], name: 'ProfileExamples' } } })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(output => output.output)
  const script = outputs.filter(output => output.type === 'chunk').map(output => output.code).join('\n')
  const css = outputs.filter(output => output.type === 'asset' && output.fileName.endsWith('.css')).map(output => String(output.source)).join('\n')
  fixtureHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Isolated profile qualification</title><style>${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`
})

test.beforeEach(async ({ page, context }) => {
  await mockCsrf(context)
  await context.route('**/logout', route => json(route, {}))
  let deviceId = ''
  await context.route('**/api/offline/bootstrap**', route => {
    deviceId = new URL(route.request().url()).searchParams.get('device_id')!
    const response = bootstrap('11', [], deviceId)
    response.server_cursor = '765430'
    return json(route, response)
  })
  await context.route('**/api/sync/pull**', route => json(route, {
    changes: [], page: { next_cursor: '765430', has_more: false }, lease: bootstrap('11', [], deviceId).lease,
  }))
  await page.route('**/__ui-profiles', route => route.fulfill({ contentType: 'text/html', body: fixtureHtml }))
  await page.goto('/__ui-profiles')
  // Seeding two real 600,000-iteration PIN keys is setup, not an interaction.
  await expect(page.getByRole('radio', { name: 'Profile 1', exact: true })).toBeVisible({ timeout: 30_000 })
})

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('ui03-isolated-profiles')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try {
      const tables = [...db.objectStoreNames]
      const tx = db.transaction(tables)
      return await Promise.all(tables.map(table => new Promise<{ table: string; rows: Record<string, unknown>[] }>((resolve, reject) => {
        const read = tx.objectStore(table).getAll()
        read.onsuccess = () => resolve({ table, rows: read.result })
        read.onerror = () => reject(read.error)
      })))
    } finally { db.close() }
  })
}

async function addUncertainWork(page: Page) {
  await page.evaluate(async () => {
    const request = indexedDB.open('ui03-isolated-profiles')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    try {
      const tx = db.transaction(['profiles', 'outboxEvents'], 'readwrite')
      const profiles = tx.objectStore('profiles').index('createdAt').getAll()
      profiles.onsuccess = () => {
        const profile = profiles.result[0]
        tx.objectStore('outboxEvents').put({ profileId: profile.id, id: 'concurrent-unverified-work', encrypted: profile.wrappedDataKey, updatedAt: 'synthetic' })
      }
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
    } finally { db.close() }
  })
}

async function recover(page: Page) {
  await page.getByLabel('Local PIN', { exact: true }).fill('184629')
  await page.getByRole('button', { name: 'Refresh authorization and sync' }).click()
  await expect(page.getByText(/Synchronization complete\. All download pages applied/)).toBeVisible()
}

test('locked profiles disclose no protected metadata in DOM or accessibility tree across responsive states', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const tree = await page.locator('body').ariaSnapshot()
    expect(tree).not.toMatch(/Protected Student|76543|00000000|pending uploads:|Downloads incomplete|0 pending uploads/i)
    expect(await page.locator('#root').innerHTML()).not.toMatch(/Protected Student|76543|"churchId"|"actorId"|"deviceId"/)
    await expect(page.getByRole('button', { name: 'Remove selected profile' })).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expectNoSeriousAccessibilityIssues(page)
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addStyleTag({ content: ':root { font-size: 200%; }' })
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByText('Forgot your PIN or unable to unlock?').click()
  await expect(page.getByText(/Church sign-in cannot reset it/)).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('profiles-locked-enlarged.png'), fullPage: true })
})

test('wrong PIN enforces persisted retry delay and correct unlock followed by lock hides synchronization state', async ({ page }) => {
  await page.clock.install()
  await page.evaluate(async () => {
    const request = indexedDB.open('ui03-isolated-profiles')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction('profiles', 'readwrite')
    const read = tx.objectStore('profiles').index('createdAt').getAll()
    read.onsuccess = () => tx.objectStore('profiles').put({ ...read.result[0], failedAttempts: 5 })
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve() })
    db.close()
  })
  await page.getByLabel('Local PIN', { exact: true }).fill('000000')
  await page.getByRole('button', { name: 'Unlock to manage profile' }).click()
  await expect(page.getByRole('alert')).toContainText('local PIN is incorrect')
  await expect(page.getByLabel('Local PIN', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Use profile 1' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Refresh authorization and sync' })).toBeDisabled()
  await page.reload()
  await expect(page.getByText(/Try again in \d+ seconds/)).toBeVisible()
  await page.clock.fastForward(33_000)
  await expect(page.getByRole('button', { name: 'Use profile 1' })).toBeEnabled()
  await recover(page)
  await expect(page.getByText(/0 pending uploads/)).toBeVisible()
  const before = await snapshot(page)
  await page.getByRole('button', { name: 'Lock profile' }).click()
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/0 pending uploads|Downloads complete|Synchronization complete/)
  expect(await snapshot(page)).toEqual(before)
  await expectNoSeriousAccessibilityIssues(page)
})

test('unknown local work blocks removal without deleting any encrypted records', async ({ page }) => {
  await recover(page)
  await addUncertainWork(page)
  const before = await snapshot(page)
  await page.getByRole('button', { name: 'Remove selected profile' }).click()
  await expect(page.getByRole('alert')).toContainText('Keep this profile')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await snapshot(page)).toEqual(before)
})

test('confirmation is cancellable and a concurrent write after confirmation opens prevents all deletion', async ({ page }) => {
  await recover(page)
  const trigger = page.getByRole('button', { name: 'Remove selected profile' })
  await trigger.click()
  await expect(page.getByRole('button', { name: 'Keep profile' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Remove Profile 1?' })).toBeVisible()
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
  }
  await expectNoSeriousAccessibilityIssues(page)
  await addUncertainWork(page)
  const before = await snapshot(page)
  await page.getByLabel('Type Profile 1 to confirm').fill('Profile 1')
  await page.getByRole('button', { name: 'Permanently remove Profile 1' }).click()
  await expect(page.getByRole('alert')).toContainText('Removal was not completed')
  expect(await snapshot(page)).toEqual(before)
})

test('safe confirmed removal affects only the selected profile and leaves another church byte-for-byte unchanged', async ({ page }) => {
  await recover(page)
  const before = await snapshot(page)
  const profiles = before.find(table => table.table === 'profiles')!.rows
  const target = profiles.find(profile => profile.churchId === churchId)!
  await page.getByRole('button', { name: 'Remove selected profile' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('profile-removal-confirmation.png'), fullPage: true })
  await expect(page.getByRole('button', { name: 'Permanently remove Profile 1' })).toBeDisabled()
  await page.getByLabel('Type Profile 1 to confirm').fill('Profile 2')
  await expect(page.getByRole('button', { name: 'Permanently remove Profile 1' })).toBeDisabled()
  await page.getByLabel('Type Profile 1 to confirm').fill('Profile 1')
  await page.getByRole('button', { name: 'Permanently remove Profile 1' }).click()
  await expect(page.getByText(/Profile 1 was removed from this device/)).toBeVisible()
  expect(await snapshot(page)).toEqual(before.map(table => ({ ...table, rows: table.rows.filter(row => (table.table === 'profiles' ? row.id : row.profileId) !== target.id) })))
  await expectNoSeriousAccessibilityIssues(page)
})
