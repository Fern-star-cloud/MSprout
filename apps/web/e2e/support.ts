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
  id: 11,
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
  await context.route('**/auth/session', route => json(route, {
    id: 11, email_verified: true, mfa_confirmed: true,
    workspaces: [{ church_id: churchId, name: 'Pilot Church', role: 'owner' }],
  }))
  await context.route('**/api/me', route => json(route, ownerAccount))
}

export async function mockCsrf(context: BrowserContext) {
  // Device-only fixtures keep UI-02's optional account read inside this synthetic context.
  // Tests for a verified session register their more specific response afterward.
  await context.route('**/auth/session', route => json(route, { code: 'unauthenticated' }, 401))
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

export async function prepareProfile(page: Page, pin = '184629', actorId = '11') {
  // Preparation now requires verified church access. These temporary, isolated
  // handlers apply only to setup; each regression's authentication fixture resumes afterward.
  const session = (route: Route) => json(route, { id: Number(actorId), email_verified: true, mfa_confirmed: false, workspaces: [{ church_id: churchId, name: 'Pilot Church', role: 'teacher' }] })
  const account = (route: Route) => json(route, { id: Number(actorId), email_verified: true, memberships: [{ church_id: churchId, role: 'teacher', status: 'active' }], assignments: { ministry_ids: [ministryId] }, active_session: { mfa_confirmed: false } })
  const ministries = (route: Route) => json(route, { data: [{ id: ministryId, name: 'Primary', status: 'active', version: 1 }] })
  await page.route('**/auth/session', session)
  await page.route('**/api/me', account)
  await page.route('**/api/ministries', ministries)
  try {
    await page.goto(`/profiles?church=${churchId}`)
    await page.getByRole('link', { name: 'Add profile' }).click()
    await page.getByRole('button', { name: 'Continue to local PIN' }).click()
    const before = await deviceRecords(page)
    await page.getByLabel('Choose a 6–12 digit local PIN').fill(pin)
    await page.getByLabel('Confirm local PIN').fill(pin)
    await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
    await expect(page.getByRole('heading', { name: 'Ready for offline attendance' })).toBeVisible()
    const after = await deviceRecords(page)
    const priorIds = before.profiles.map(row => row.id)
    const created = after.profiles.filter(row => !priorIds.includes(row.id))
    expect(created).toHaveLength(1)
    const profileId = created[0].id
    // Preparing another profile must preserve every existing row, including pending
    // attendance owned by other profiles, and must not create attendance itself.
    for (const [table, rows] of Object.entries(before)) {
      expect(after[table].filter(row => table === 'profiles' ? row.id !== profileId : row.profileId !== profileId), table).toEqual(rows)
    }
    expect(after.attendanceDrafts).toEqual(before.attendanceDrafts)
    expect(after.outboxEvents).toEqual(before.outboxEvents)
    expect(after.conflicts).toEqual(before.conflicts)
    expect(after.encryptedBlobs.filter(row => row.profileId === profileId)).toHaveLength(3)
  } finally {
    await page.unroute('**/auth/session', session)
    await page.unroute('**/api/me', account)
    await page.unroute('**/api/ministries', ministries)
  }
}

export async function deviceRecords(page: Page): Promise<Record<string, Record<string, unknown>[]>> {
  return page.evaluate(async () => {
    const request = indexedDB.open('ministry-sprout-offline')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const tables = [...database.objectStoreNames]
      const transaction = database.transaction(tables)
      const records = await Promise.all(tables.map(table => new Promise<[string, Record<string, unknown>[]]>((resolve, reject) => {
        const read = transaction.objectStore(table).getAll()
        read.onsuccess = () => resolve([table, read.result])
        read.onerror = () => reject(read.error)
      })))
      return Object.fromEntries(records)
    } finally { database.close() }
  })
}

export async function addProfile(page: Page, pin = '184629', actorId = '11') {
  await prepareProfile(page, pin, actorId)
  await page.getByRole('button', { name: 'Open Attendance' }).click()
  await expect(page.getByRole('heading', { name: 'Take attendance' })).toBeVisible()
  await page.getByRole('button', { name: 'Start attendance' }).click()
  await expect.poll(() => outboxCount(page)).toBeGreaterThan(0)
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
