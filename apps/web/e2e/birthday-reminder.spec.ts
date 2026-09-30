import { expect, test } from '@playwright/test'
import { churchId, expectNoSeriousAccessibilityIssues, json } from './support'

test.use({ serviceWorkers: 'block' })

test('authorized birthday fallback shows names only in-app and notification permission is deliberate and privacy-safe', async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Notification', { configurable: true, value: {
      permission: 'default', requestPermission: async () => 'denied',
    } })
    Object.defineProperty(window, 'PushManager', { configurable: true, value: class PushManager {} })
  })
  await context.route('**/api/birthdays/today', route => json(route, { data: {
    local_date: '2026-09-30', timezone: 'Asia/Manila', role: 'owner', count: 1,
    birthdays: [{ id: '00000000-0000-4000-8000-000000000031', display_name: 'Pilot Student A', turning_age: 8, ministry_names: ['Primary'] }],
  } }))
  await context.route('**/api/push-subscriptions/config', route => json(route, { configured: true, vapid_public_key: 'AQIDBA' }))

  await page.goto(`/account/birthdays?church=${churchId}`)
  await expect(page.getByText('Pilot Student A')).toBeVisible()
  await expect(page.getByText('Turning 8 · Primary')).toBeVisible()
  await expect(page.getByText('Push reminders contain a count only.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enable Birthday Notifications' })).toBeVisible()
  await page.getByRole('button', { name: 'Enable Birthday Notifications' }).click()
  await expect(page.getByText('Notifications were not enabled. Sprout will not ask again.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enable Birthday Notifications' })).toHaveCount(0)
  await expectNoSeriousAccessibilityIssues(page)
})
