import { expect, test, type Page } from '@playwright/test'
import { addProfile, bootstrap, json, mockCsrf, outboxCount } from './support'

test.use({ serviceWorkers: 'block' })

async function encryptedStoreFingerprint(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ministry-sprout-offline')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const records = await Promise.all([...db.objectStoreNames].map(name => new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction(name).objectStore(name).getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })))
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(records)))
      return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
    } finally { db.close() }
  })
}

for (const redirected of [false, true]) {
  test(`existing-session ${redirected ? 'unexpected redirect is rejected safely' : 'conflict directs explicit session verification'}`, async ({ page, context }) => {
    // All endpoints intercepted; disposable encrypted fixture only, never the human profile/API.
    await mockCsrf(context)
    let syncRequests = 0
    let sessionReads = 0
    let rootNavigations = 0
    await context.route('**/api/**', route => json(route, {}, 503))
    await context.route('**/api/sync/**', route => { syncRequests++; return json(route, {}, 503) })
    await context.route('**/api/offline/bootstrap**', route => {
      const result = bootstrap('11', undefined, new URL(route.request().url()).searchParams.get('device_id')!)
      result.lease.expires_at = new Date(Date.now() + 14 * 86400000).toISOString()
      return json(route, result)
    })
    await addProfile(page)
    await page.getByRole('button', { name: 'Mark Pilot Student A present' }).click()
    await page.getByLabel('Display name').fill('Pilot Guest')
    await page.getByRole('button', { name: 'Add guest as present' }).click()
    await expect(page.getByText(/3 pending/)).toBeVisible()
    const stored = await encryptedStoreFingerprint(page)
    await context.route(/\/login$/, route => {
      if (route.request().isNavigationRequest()) return route.fallback()
      expect(route.request().headers()['accept']).toBe('application/json')
      expect(route.request().headers()['x-requested-with']).toBe('XMLHttpRequest')
      expect(Boolean(route.request().headers()['x-xsrf-token'])).toBe(true)
      if (redirected) return route.fulfill({ status: 302, headers: { Location: 'http://127.0.0.1:4173/' } })
      return json(route, { code: 'already_authenticated', message: 'untrusted private detail' }, 409)
    })
    await context.route('**/auth/session', route => {
      sessionReads++
      return json(route, { id: 11, email_verified: true, mfa_confirmed: false, workspaces: [] })
    })
    page.on('request', request => { if (request.url() === 'http://127.0.0.1:4173/') rootNavigations++ })
    await page.goto('/account/login')
    await page.getByLabel('Email').fill('different@example.test')
    await page.getByLabel('Password', { exact: true }).fill(crypto.randomUUID())
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(redirected ? 'The request could not be completed' : 'A session is already signed in')
    await expect(page.getByRole('alert')).not.toContainText('untrusted private detail')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
    expect(sessionReads).toBe(0)
    expect(rootNavigations).toBe(0)
    expect(page.url()).toContain('/account/login')
    await page.getByRole('button', { name: 'Continue signed-in session' }).click()
    await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible()
    expect(sessionReads).toBe(1)
    expect(await outboxCount(page)).toBe(3)
    expect(await encryptedStoreFingerprint(page)).toBe(stored)
    expect(syncRequests).toBe(0)
  })
}
