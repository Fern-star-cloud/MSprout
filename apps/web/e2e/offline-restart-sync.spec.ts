import { expect, test } from '@playwright/test'
import { bootstrap, churchId, json, mockCsrf, outboxCount } from './support'

test.use({ serviceWorkers: 'block' })

test('offline attendance survives browser closure and converges exactly once after bounded worker retry', async ({ page, context }) => {
  await mockCsrf(context)
  await context.route('**/api/offline/bootstrap**', route => {
    const deviceId = new URL(route.request().url()).searchParams.get('device_id')!
    return json(route, bootstrap('11', undefined, deviceId))
  })

  const received = new Set<string>()
  let pushAttempts = 0
  let acceptedEvents = 0
  await context.route('**/api/sync/push', async route => {
    pushAttempts += 1
    const payload = route.request().postDataJSON() as { events: Array<{ client_event_id: string; entity_id: string; base_version: number }> }
    if (pushAttempts < 3) {
      await json(route, { message: 'Temporary worker outage' }, 503)
      return
    }
    for (const event of payload.events) {
      if (!received.has(event.client_event_id)) acceptedEvents += 1
      received.add(event.client_event_id)
    }
    await json(route, { results: payload.events.map(event => ({
      client_event_id: event.client_event_id, status: 'accepted', record_id: event.entity_id, version: event.base_version + 1,
    })) })
  })
  await context.route('**/api/sync/pull**', route => {
    const deviceId = route.request().headers()['x-device-id']
    return json(route, {
      changes: [], page: { next_cursor: '3', has_more: false },
      lease: { ...bootstrap().lease, device_id: deviceId, issued_at: '2026-09-30T00:05:00Z', expires_at: '2099-10-14T00:05:00Z', signature: 'b'.repeat(64) },
    })
  })

  await page.goto(`/profiles?church=${churchId}`)
  await page.getByRole('button', { name: 'Add profile' }).click()
  await page.getByLabel('Choose a 6–12 digit local PIN').fill('184629')
  await page.getByRole('button', { name: 'Download assigned roster and create profile' }).click()
  await context.setOffline(true)
  const initialDate = await page.getByLabel('Attendance date').inputValue()
  const pilotDates = Array.from({ length: 4 }, (_, daysAgo) => {
    const date = new Date(`${initialDate}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - daysAgo)
    return date.toISOString().slice(0, 10)
  })
  for (const attendanceDate of pilotDates) {
    await page.getByLabel('Attendance date').fill(attendanceDate)
    await expect(page.getByRole('button', { name: 'Mark all unmarked present' })).toBeEnabled()
    await page.getByRole('button', { name: 'Mark all unmarked present' }).click()
    await page.getByRole('button', { name: 'Finalize attendance' }).click()
    await expect(page.getByText(/Pending Sync/)).toBeVisible()
  }
  expect(await outboxCount(page)).toBe(12)

  await page.close()
  await context.setOffline(false)
  const reopened = await context.newPage()
  await reopened.goto(`/profiles?church=${churchId}`)
  await context.setOffline(true)
  await reopened.getByLabel('Local PIN').fill('184629')
  await reopened.getByRole('button', { name: 'Use profile 1' }).click()
  await expect(reopened.getByText(/Pending Sync/)).toBeVisible()
  expect(await outboxCount(reopened)).toBe(12)

  await context.setOffline(false)
  await reopened.goto(`/profiles?church=${churchId}`)
  await reopened.getByLabel('Local PIN').fill('184629')
  await reopened.getByRole('button', { name: 'Refresh authorization after sign-in' }).click()
  await expect.poll(() => outboxCount(reopened), { timeout: 10_000 }).toBe(0)
  expect(pushAttempts).toBe(3)
  expect(received.size).toBe(12)
  expect(acceptedEvents).toBe(12)

  await reopened.reload()
  await reopened.waitForTimeout(300)
  expect(received.size).toBe(12)
  expect(acceptedEvents).toBe(12)
})
