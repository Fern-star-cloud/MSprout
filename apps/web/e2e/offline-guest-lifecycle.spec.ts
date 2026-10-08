import { expect, test } from '@playwright/test'
import { addProfile, bootstrap, churchId, json, mockCsrf, outboxCount } from './support'

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context }) => {
  await mockCsrf(context)
  // Fresh Playwright contexts only: intercept every API request, never use the human profile or live API.
  await context.route('**/api/**', route => json(route, {}, 503))
  await context.route('**/logout', route => json(route, {}))
  await context.route('**/api/offline/bootstrap**', route => {
    const response = bootstrap('11', [], new URL(route.request().url()).searchParams.get('device_id')!)
    response.lease.issued_at = new Date().toISOString()
    response.lease.expires_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    return json(route, response)
  })
})

test('Church ID pattern is valid in Chrome and rejects invalid input', async ({ page }) => {
  await page.goto(`/profiles?church=${churchId}`)
  await page.getByRole('button', { name: 'Add profile' }).click()
  const input = page.getByLabel('Church ID')
  expect(await input.evaluate((element: HTMLInputElement) => new RegExp(element.pattern, 'v').test(element.value))).toBe(true)
  await input.fill('z'.repeat(36))
  expect(await input.evaluate((element: HTMLInputElement) => element.validity.patternMismatch)).toBe(true)
})

test('network offline, focus loss and mobile emulation retain encrypted guest writes', async ({ page, context }) => {
  const received = new Map<string, string>()
  await context.route('**/api/sync/push', async route => {
    const request = route.request().postDataJSON() as { events: Array<{ client_event_id: string; entity_id: string; base_version: number; action: string }> }
    expect(route.request().headers()['x-church-id']).toBe(churchId)
    for (const event of request.events) received.set(event.client_event_id, event.action)
    await json(route, { results: request.events.map(event => ({ client_event_id: event.client_event_id,
      status: 'accepted', record_id: event.entity_id, version: event.base_version + 1 })) })
  })
  await context.route('**/api/sync/pull**', route => json(route, {
    changes: [], page: { next_cursor: '2', has_more: false },
    lease: bootstrap('11', [], route.request().headers()['x-device-id']).lease,
  }))
  await addProfile(page)
  await expect(page.getByText(/1 pending/)).toBeVisible()
  expect(await outboxCount(page)).toBe(1)
  // Reproduce the reported short foreground interval with the real 14-day lease duration.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 4_000)))
  expect(await page.evaluate(() => document.visibilityState)).toBe('visible')
  await expect(page.getByRole('button', { name: 'Add guest as present' })).toBeVisible()
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.getByLabel('Display name').fill('MTQA Offline Guest')
  await page.getByRole('button', { name: 'Add guest as present' }).click()
  await expect(page.getByText('MTQA Offline Guest', { exact: true })).toBeVisible()
  await expect(page.getByText(/Saved on this device$/)).toBeVisible()
  expect(await outboxCount(page)).toBe(2)
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => outboxCount(page)).toBe(0)
  expect([...received.values()].sort()).toEqual(['attendance.draft_created', 'attendance.guest_added'])
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText(/No pending changes/)).toBeVisible()
  expect(received.size).toBe(2)
})

test('five minutes of inactivity clears the open attendance view without deleting its pending event', async ({ page }) => {
  await page.clock.install()
  await addProfile(page)
  await expect(page.getByText(/1 pending/)).toBeVisible()
  await page.clock.fastForward('05:01')
  await expect(page.getByRole('link', { name: 'Choose a device profile' })).toBeVisible()
  await expect(page.locator('[data-profile-lock-reason]')).toHaveAttribute('data-profile-lock-reason', 'inactivity')
  expect(await outboxCount(page)).toBe(1)
})

test('a hidden page locks the key, clears stale attendance controls, and preserves queued work for PIN unlock', async ({ page, context }) => {
  await addProfile(page)
  await expect(page.getByText(/1 pending/)).toBeVisible()
  await context.setOffline(true)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
  })
  await expect(page.getByRole('link', { name: 'Choose a device profile' })).toBeVisible()
  await expect(page.locator('[data-profile-lock-reason]')).toHaveAttribute('data-profile-lock-reason', 'background')
  await expect(page.getByRole('button', { name: 'Add guest as present' })).toHaveCount(0)
  expect(await outboxCount(page)).toBe(1)
  await context.setOffline(false)
  await page.getByRole('link', { name: 'Choose a device profile' }).click()
  await context.setOffline(true)
  await page.getByLabel('Local PIN', { exact: true }).fill('184629')
  await expect(page.getByLabel('Local PIN', { exact: true })).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await expect(page.getByText(/1 pending/)).toBeVisible()
  await page.getByLabel('Display name').fill('MTQA Offline Guest')
  await page.getByRole('button', { name: 'Add guest as present' }).click()
  await expect(page.getByText('MTQA Offline Guest', { exact: true })).toBeVisible()
  expect(await outboxCount(page)).toBe(2)
})
