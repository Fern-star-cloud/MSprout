import { expect, test } from '@playwright/test'
import { addProfile } from './support'

test.use({ serviceWorkers: 'block' })

const churchId = '00000000-0000-4000-8000-000000000010'
const ministryId = '00000000-0000-4000-8000-000000000020'
const studentIds = ['00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000032']

test('offline attendance converges once after a lost response, reconnect, and restart', async ({ page, context }) => {
  const received = new Set<string>()
  let committedResponseLost = false
  await context.addCookies([{ name: 'XSRF-TOKEN', value: 'test-token', url: 'http://127.0.0.1:4173' }])

  await page.route('**/api/offline/bootstrap**', async route => {
    const deviceId = new URL(route.request().url()).searchParams.get('device_id')!
    await route.fulfill({ json: {
      actor: { id: '11' },
      ministries: [{ id: ministryId, name: 'Primary', version: 1 }],
      roster: studentIds.map((id, index) => ({
        id, display_name: index === 0 ? 'Ana Sprout' : 'Ben Sprout', gender: 'unspecified', version: 1,
        ministry_ids: [ministryId], next_birthday_month_day: null, turning_age: null,
      })),
      lease: {
        actor_id: '11', church_id: churchId, membership_id: '00000000-0000-4000-8000-000000000040', device_id: deviceId,
        issued_at: '2026-09-29T00:00:00Z', expires_at: '2026-10-13T00:00:00Z', signature: 'a'.repeat(64),
      },
      server_cursor: '0',
    } })
  })
  await page.route('**/api/sync/push', async route => {
    const request = route.request().postDataJSON() as { events: Array<{ client_event_id: string; entity_id: string; base_version: number }> }
    for (const event of request.events) received.add(event.client_event_id)
    if (!committedResponseLost) {
      committedResponseLost = true
      await route.abort('connectionfailed')
      return
    }
    await route.fulfill({ json: { results: request.events.map(event => ({
      client_event_id: event.client_event_id, status: 'duplicate', original_status: 'accepted',
      record_id: event.entity_id, version: event.base_version + 1,
    })) } })
  })
  await page.route('**/api/sync/pull**', async route => {
    const deviceId = route.request().headers()['x-device-id']
    await route.fulfill({ json: {
      changes: [], page: { next_cursor: '3', has_more: false },
      lease: {
        actor_id: '11', church_id: churchId, membership_id: '00000000-0000-4000-8000-000000000040', device_id: deviceId,
        issued_at: '2026-09-29T00:05:00Z', expires_at: '2026-10-13T00:05:00Z', signature: 'b'.repeat(64),
      },
    } })
  })

  await addProfile(page)

  await context.setOffline(true)
  await page.getByRole('button', { name: 'Mark all unmarked present' }).click()
  await page.getByRole('button', { name: 'Finalize attendance' }).click()
    await page.getByRole('button', { name: 'Finalize on this device' }).click()
  await expect(page.getByText(/Saved on this device — Pending Sync/)).toBeVisible()

  await context.setOffline(false)
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')))
  await expect.poll(async () => page.evaluate(async () => {
    const request = indexedDB.open('ministry-sprout-offline')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const count = await new Promise<number>((resolve, reject) => {
      const value = database.transaction('outboxEvents').objectStore('outboxEvents').count()
      value.onsuccess = () => resolve(value.result)
      value.onerror = () => reject(value.error)
    })
    database.close()
    return count
  })).toBe(0)

  const authoritativeCount = received.size
  expect(authoritativeCount).toBe(3)
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')))
  await page.waitForTimeout(300)
  expect(received.size).toBe(authoritativeCount)
})
