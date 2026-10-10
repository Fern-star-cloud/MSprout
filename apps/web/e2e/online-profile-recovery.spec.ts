import { expect, test, type Page } from '@playwright/test'
import { addProfile, bootstrap, churchId, json, ministryId, mockCsrf, outboxCount } from './support'
import { openChurchDestination } from './navigation-support'

test.use({ serviceWorkers: 'block' })

async function localWorkFingerprint(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ministry-sprout-offline')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const tables = ['encryptedBlobs', 'attendanceDrafts', 'outboxEvents', 'serverCursors', 'conflicts', 'metadata']
      const records = await Promise.all(tables.map(name => new Promise<unknown[]>((resolve, reject) => {
        const request = database.transaction(name).objectStore(name).getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })))
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(records)))
      return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
    } finally { database.close() }
  })
}

test('online profile use logs out a recent session; signing in afterward opens Review without consuming local work', async ({ page, context }) => {
  // Disposable contexts and intercepted endpoints only. Never use the human profile or live API.
  await mockCsrf(context)
  let signedIn = true
  let syncRequests = 0
  const authentication: string[] = []
  await context.route('**/api/**', route => json(route, {}, 503))
  await context.route('**/api/sync/**', route => { syncRequests++; return json(route, {}, 503) })
  await context.route(/\/login$/, route => {
    if (route.request().isNavigationRequest()) return route.fallback()
    signedIn = true
    authentication.push('login:200')
    return json(route, { two_factor: false })
  })
  await context.route('**/logout', route => {
    expect(route.request().method()).toBe('POST')
    expect(Boolean(route.request().headers()['x-xsrf-token'])).toBe(true)
    signedIn = false
    authentication.push('logout:204')
    return route.fulfill({ status: 204 })
  })
  await context.route('**/auth/session', route => {
    authentication.push(`session:${signedIn ? 200 : 401}`)
    return json(route, signedIn ? { id: 11, email_verified: true, mfa_confirmed: false,
      workspaces: [{ church_id: churchId, name: 'Pilot Church', role: 'teacher' }] } : {}, signedIn ? 200 : 401)
  })
  await context.route('**/api/me', route => json(route, {
    id: 11, email_verified: true, active_session: { mfa_confirmed: false },
    memberships: [{ church_id: churchId, role: 'teacher', status: 'active' }], assignments: { ministry_ids: [ministryId] },
  }, signedIn ? 200 : 401))
  await context.route('**/api/sync-conflicts', route => {
    expect(route.request().headers()['x-church-id']).toBe(churchId)
    return json(route, { role: 'teacher', needs_owner_review: false }, signedIn ? 200 : 401)
  })
  await context.route('**/api/offline/bootstrap**', route => {
    const response = bootstrap('11', undefined, new URL(route.request().url()).searchParams.get('device_id')!)
    response.ministries[0].name = 'Music'
    response.lease.issued_at = new Date().toISOString()
    response.lease.expires_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    return json(route, response)
  })
  await addProfile(page)
  await page.getByRole('button', { name: 'Mark Pilot Student A present' }).click()
  await page.getByRole('button', { name: 'Add temporary guest' }).click()

  await page.getByLabel('Display name').fill('Pilot Offline Guest')
  await page.getByRole('button', { name: 'Add guest as present' }).click()
  await expect(page.getByText(/3 pending/)).toBeVisible()
  const work = await localWorkFingerprint(page)

  const signIn = async () => {
    await page.goto('/account/login')
    await page.getByLabel('Email').fill('teacher@example.test')
    await page.getByLabel('Password', { exact: true }).fill(crypto.randomUUID())
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible()
  }
  await signIn()
  expect(authentication.slice(-2)).toEqual(['login:200', 'session:200'])
  await page.goto('/profiles')
  await page.getByLabel('Local PIN', { exact: true }).fill('184629')
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await page.getByRole('button', { name: 'Resume attendance' }).click()
  await expect(page.getByText(/3 pending/)).toBeVisible()
  await expect(page.getByText('Pilot Offline Guest', { exact: true })).toBeVisible()
  expect(authentication.filter(event => event === 'logout:204')).toHaveLength(1)
  expect(await outboxCount(page)).toBe(3)
  expect(await localWorkFingerprint(page)).toBe(work)

  // Unverified/Teacher navigation no longer exposes Owner Review. Home is a protected online entry.
  await openChurchDestination(page, 'Home', 'teacher')
  await expect(page.getByRole('alert')).toContainText('Please sign in again to open your church workspace')
  expect(authentication.at(-1)).toBe('session:401')
  const denied = authentication.filter(event => event === 'session:401').length
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => authentication.filter(event => event === 'session:401').length).toBe(denied + 1)

  // Reauthentication follows profile selection; do not select the profile again afterward.
  await signIn()
  await page.goto('/account/conflicts')
  await expect(page.getByRole('heading', { name: 'Attendance review' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(authentication.at(-1)).toBe('session:200')
  expect(authentication.filter(event => event === 'logout:204')).toHaveLength(1)
  expect(await outboxCount(page)).toBe(3)
  expect(await localWorkFingerprint(page)).toBe(work)
  expect(syncRequests).toBe(0)
})
