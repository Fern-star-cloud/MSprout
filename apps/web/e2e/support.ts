import AxeBuilder from '@axe-core/playwright'
import { expect, type BrowserContext, type Page, type Route } from '@playwright/test'

export const churchId = '00000000-0000-4000-8000-000000000010'
export const otherChurchId = '00000000-0000-4000-8000-000000000011'
export const ministryId = '00000000-0000-4000-8000-000000000020'
export const studentIds = [
  '00000000-0000-4000-8000-000000000031',
  '00000000-0000-4000-8000-000000000032',
]

export const ownerAccount = {
  active_session: { email_verified: true, mfa_confirmed: true },
  memberships: [{ church_id: churchId, role: 'owner', status: 'active' }],
}

export async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

export async function expectNoSeriousAccessibilityIssues(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const blocking = results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')
  expect(blocking, blocking.map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`).join('\n')).toEqual([])
}

export async function mockOwner(context: BrowserContext) {
  await context.route('**/api/me', route => json(route, ownerAccount))
}

export async function mockCsrf(context: BrowserContext) {
  await context.addCookies([{ name: 'XSRF-TOKEN', value: 'pilot-token', url: 'http://127.0.0.1:4173' }])
  await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }))
}

export function bootstrap(actorId = '11', roster = studentIds.map((id, index) => ({
  id,
  display_name: index === 0 ? 'Pilot Student A' : 'Pilot Student B',
  gender: 'unspecified' as const,
  version: 1,
  ministry_ids: [ministryId],
  next_birthday_month_day: index === 0 ? '09-30' : null,
  turning_age: index === 0 ? 8 : null,
})), deviceId = '00000000-0000-4000-8000-000000000050') {
  return {
    actor: { id: actorId },
    timezone: 'Asia/Manila',
    ministries: [{ id: ministryId, name: 'Primary', version: 1 }],
    roster,
    lease: {
      actor_id: actorId,
      church_id: churchId,
      membership_id: '00000000-0000-4000-8000-000000000040',
      device_id: deviceId,
      issued_at: '2026-09-30T00:00:00Z',
      expires_at: '2099-10-14T00:00:00Z',
      signature: 'a'.repeat(64),
    },
    server_cursor: '0',
  }
}

export async function addProfile(page: Page, pin = '184629') {
  await page.goto(`/profiles?church=${churchId}`)
  await page.getByRole('button', { name: 'Add profile' }).click()
  await page.getByLabel('Choose a 6–12 digit local PIN').fill(pin)
  await page.getByRole('button', { name: 'Download assigned roster and create profile' }).click()
  await expect(page.getByRole('heading', { name: 'Take attendance' })).toBeVisible()
}

export async function outboxCount(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('ministry-sprout-offline')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const count = await new Promise<number>((resolve, reject) => {
      const result = database.transaction('outboxEvents').objectStore('outboxEvents').count()
      result.onsuccess = () => resolve(result.result)
      result.onerror = () => reject(result.error)
    })
    database.close()
    return count
  })
}
