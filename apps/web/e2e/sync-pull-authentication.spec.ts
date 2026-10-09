import { expect, test as base } from '@playwright/test'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { addProfile, bootstrap, churchId, expectNoSeriousAccessibilityIssues, json, mockCsrf, outboxCount } from './support'

const test = base.extend<{ pullTransport: { url: string; respond: (handler: (request: IncomingMessage, response: ServerResponse) => void) => void; errors: string[] } }>({
  pullTransport: async ({ baseURL }, provide) => {
    let handler = (_request: IncomingMessage, response: ServerResponse) => { response.writeHead(404); response.end() }
    const errors: string[] = []
    const server = createServer((request, response) => {
      response.setHeader('Access-Control-Allow-Origin', baseURL!)
      response.setHeader('Access-Control-Allow-Credentials', 'true')
      response.setHeader('Access-Control-Allow-Headers', 'content-type, x-church-id, x-device-id, x-correlation-id, accept')
      if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }
      try { handler(request, response) } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Wire assertion failed')
        response.writeHead(500); response.end()
      }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try { await provide({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, respond: next => { handler = next }, errors }) }
    finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
  },
})

function wireJson(response: ServerResponse, body: unknown, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

test.use({ serviceWorkers: 'block' })

for (const failPull of [false, true]) {
  test(`sync uses origin-only referrers and reports ${failPull ? 'incomplete download' : 'completed download'} after accepted uploads`, async ({ page, context, pullTransport }) => {
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
    // Inspect actual wire headers: WebKit interception metadata can omit cookies.
    pullTransport.respond((request, response) => {
      const headers = request.headers
      const referrer = headers['referer']
      pullReferrers.push(referrer)
      // A rewritten loopback port can add a CORS Origin in WebKit; only this test origin is allowed.
      expect(headers['origin'] === undefined || headers['origin'] === 'http://127.0.0.1:4173').toBe(true)
      if (!referrer) return wireJson(response, { code: 'unauthenticated', message: 'Authentication is required.' }, 401)
      expect(headers['x-church-id']).toBe(churchId)
      expect(headers['cookie']?.includes('XSRF-TOKEN=pilot-token')).toBe(true)
      if (pullDenied) return wireJson(response, { code: 'unauthenticated', message: 'Authentication is required.' }, 401)
      expect(referrer).toBe('http://127.0.0.1:4173/')
      const lease = bootstrap('11', undefined, headers['x-device-id'] as string).lease
      lease.issued_at = new Date().toISOString()
      lease.expires_at = new Date(Date.now() + 14 * 86400000).toISOString()
      const cursor = new URL(request.url!, pullTransport.url).searchParams.get('cursor')
      wireJson(response, { changes: [], page: { next_cursor: cursor === '0' ? '2' : '3', has_more: cursor === '0' }, lease })
    })
    await context.route('**/api/sync/pull**', async route => {
      // Preserve the original same-origin request assurance before the test-only rewrite.
      expect((await route.request().allHeaders())['origin']).toBeUndefined()
      const original = new URL(route.request().url())
      return route.continue({ url: `${pullTransport.url}${original.pathname}${original.search}` })
    })
    await addProfile(page)
    // Characterize the actual browser defaults under the shipped no-referrer document policy.
    const headerless = await page.evaluate(async () => (await fetch('/api/sync/pull?cursor=0&limit=100', { credentials: 'include' })).status)
    expect(pullTransport.errors).toEqual([])
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
    if (failPull) {
      // UI-03 hides protected status after authorization is invalidated. Durable
      // acknowledgement/completion flags are still asserted directly below.
      await expect(page.getByText(/Protected status is unavailable/)).toBeVisible()
      await expect(page.getByText(/0 pending uploads.*Downloads incomplete/)).toHaveCount(0)
    } else await expect(page.getByText(/0 pending uploads.*Downloads complete$/)).toBeVisible()
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
    expect(pullTransport.errors).toEqual([])
  })
}
