import { expect, test } from '@playwright/test'
import { addProfile, bootstrap, churchId, expectNoSeriousAccessibilityIssues, json, mockCsrf, outboxCount } from './support'

test.use({ serviceWorkers: 'block' })

for (const failPull of [false, true]) {
  test(`sync uses origin-only referrers and reports ${failPull ? 'incomplete download' : 'completed download'} after accepted uploads`, async ({ page, context }) => {
    await mockCsrf(context)
    let accepted = 0
    let pushRequests = 0
    let pullDenied = failPull
    let logouts = 0
    const pullReferrers: Array<string | undefined> = []
    await context.route('**/api/**', route => json(route, {}, 503))
    await context.route('**/logout', route => { logouts++; return route.fulfill({ status: 204 }) })
    await context.route('**/api/offline/bootstrap**', route => {
      const result = bootstrap('11', undefined, new URL(route.request().url()).searchParams.get('device_id')!)
      result.lease.issued_at = new Date().toISOString()
      result.lease.expires_at = new Date(Date.now() + 14 * 86400000).toISOString()
      return json(route, result)
    })
    await context.route('**/api/sync/push', route => {
      pushRequests++
      expect(route.request().headers()['referer']).toBe('http://127.0.0.1:4173/')
      const body = route.request().postDataJSON() as { events: Array<{ client_event_id: string; entity_id: string; base_version: number }> }
      expect(body.events).toHaveLength(3)
      accepted += body.events.length
      return json(route, { results: body.events.map(event => ({
        client_event_id: event.client_event_id, record_id: event.entity_id, status: 'accepted', version: event.base_version + 1,
      })) })
    })
    await context.route('**/api/sync/pull**', async route => {
      const headers = await route.request().allHeaders()
      const referrer = headers['referer']
      pullReferrers.push(referrer)
      expect(headers['origin']).toBeUndefined()
      if (!referrer) return json(route, { code: 'unauthenticated', message: 'Authentication is required.' }, 401)
      expect(headers['x-church-id']).toBe(churchId)
      expect(headers['cookie']).toContain('XSRF-TOKEN=pilot-token')
      if (pullDenied) return json(route, { code: 'unauthenticated', message: 'Authentication is required.' }, 401)
      expect(referrer).toBe('http://127.0.0.1:4173/')
      const lease = bootstrap('11', undefined, route.request().headers()['x-device-id']).lease
      lease.issued_at = new Date().toISOString()
      lease.expires_at = new Date(Date.now() + 14 * 86400000).toISOString()
      const cursor = new URL(route.request().url()).searchParams.get('cursor')
      return json(route, { changes: [], page: { next_cursor: cursor === '0' ? '2' : '3', has_more: cursor === '0' }, lease })
    })
    await addProfile(page)
    // Characterize the actual browser defaults under the shipped no-referrer document policy.
    const headerless = await page.evaluate(async () => (await fetch('/api/sync/pull?cursor=0&limit=100', { credentials: 'include' })).status)
    expect(headerless).toBe(401)
    expect(pullReferrers).toEqual([undefined])
    await page.getByRole('button', { name: 'Mark Pilot Student A present' }).click()
    await page.getByLabel('Display name').fill('Isolated Offline Guest')
    await page.getByRole('button', { name: 'Add guest as present' }).click()
    await expect(page.getByText(/3 pending/)).toBeVisible()
    await page.goto('/profiles')
    await page.getByLabel('Local PIN', { exact: true }).fill('184629')
    await page.getByRole('button', { name: 'Refresh authorization and sync' }).click()
    await expect.poll(() => outboxCount(page)).toBe(0)
    await expect(page).toHaveURL(/\/profiles$/)
    await expect(page.getByRole('heading', { name: 'Take attendance' })).toHaveCount(0)
    await expect(page.getByText(failPull ? /0 pending uploads.*Downloads incomplete/ : /0 pending uploads.*Downloads complete$/)).toBeVisible()
    if (failPull) await expect(page.getByText(/Online sign-in required.*Synchronization is incomplete/)).toBeVisible()
    else await expect(page.getByText(/Synchronization complete.*download pages/)).toBeVisible()
    expect(accepted).toBe(3)
    expect(logouts).toBe(0)
    expect(pullReferrers).toEqual(failPull ? [undefined, 'http://127.0.0.1:4173/'] : [undefined, 'http://127.0.0.1:4173/', 'http://127.0.0.1:4173/'])
    await expectNoSeriousAccessibilityIssues(page)
    await page.reload()
    // The completion flag survives document/key disposal; no retry or replay occurs on reload.
    const needsPull = await page.evaluate(async () => {
      const request = indexedDB.open('ministry-sprout-offline')
      const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
      try {
        const records = db.transaction('profiles').objectStore('profiles').getAll()
        return await new Promise<boolean>(resolve => { records.onsuccess = () => resolve(records.result[0].syncNeedsPull) })
      } finally { db.close() }
    })
    expect(needsPull).toBe(failPull)
    expect(accepted).toBe(3)

    // Recover after document/key disposal, then repeat. Only pull is needed;
    // acknowledgements are durable and Attendance is never mounted by recovery.
    pullDenied = false
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByLabel('Local PIN', { exact: true }).fill('184629')
      await page.getByRole('button', { name: 'Refresh authorization and sync' }).click()
      await expect(page.getByText(/Synchronization complete.*download pages/)).toBeVisible()
      await expect(page).toHaveURL(/\/profiles$/)
      expect(await outboxCount(page)).toBe(0)
      expect(accepted).toBe(3)
      expect(pushRequests).toBe(1)
    }
    const draftCount = await page.evaluate(async () => {
      const request = indexedDB.open('ministry-sprout-offline')
      const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
      try {
        const count = db.transaction('attendanceDrafts').objectStore('attendanceDrafts').count()
        return await new Promise<number>(resolve => { count.onsuccess = () => resolve(count.result) })
      } finally { db.close() }
    })
    expect(draftCount).toBe(1)
    expect(logouts).toBe(0)
  })
}
