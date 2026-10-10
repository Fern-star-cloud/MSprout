import { expect, test } from '@playwright/test'
import { addProfile, bootstrap, churchId, expectNoSeriousAccessibilityIssues, json, mockCsrf } from './support'

test.use({ serviceWorkers: 'block' })

test('two encrypted PIN profiles keep assigned rosters and actors separate', async ({ page, context }) => {
  await mockCsrf(context)
  let actor = '11'
  await context.route('**/api/offline/bootstrap**', route => json(route, bootstrap(actor, [{
    id: actor === '11' ? '00000000-0000-4000-8000-000000000031' : '00000000-0000-4000-8000-000000000032',
    display_name: actor === '11' ? 'Teacher One Roster' : 'Teacher Two Roster',
    gender: 'unspecified', version: 1, ministry_ids: ['00000000-0000-4000-8000-000000000020'],
    next_birthday_month_day: null, turning_age: null,
  }], new URL(route.request().url()).searchParams.get('device_id')!)))
  await context.route('**/logout', route => json(route, {}))

  await addProfile(page)
  await expect(page.getByText('Teacher One Roster')).toBeVisible()

  actor = '22'
  await addProfile(page, '295730', actor)
  await expect(page.getByText('Teacher Two Roster')).toBeVisible()
  await expect(page.getByText('Teacher One Roster')).toHaveCount(0)

  await page.goto(`/profiles?church=${churchId}`)
  await page.getByLabel(/Profile 1/).check()
  await page.getByLabel('Local PIN').fill('184629')
  await page.getByRole('button', { name: 'Use profile 1' }).click()
  await page.getByRole('button', { name: 'Resume attendance' }).click()
  await expect(page.getByText('Teacher One Roster')).toBeVisible()
  await expect(page.getByText('Teacher Two Roster')).toHaveCount(0)
  await expectNoSeriousAccessibilityIssues(page)
})

test('a simulated storage quota failure stops attendance before claiming success', async ({ page, context }) => {
  await mockCsrf(context)
  await context.route('**/api/offline/bootstrap**', route => json(route, bootstrap('11', undefined, new URL(route.request().url()).searchParams.get('device_id')!)))
  await addProfile(page)
  await expect(page.getByText('Pilot Student A')).toBeVisible()

  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'attendanceDrafts' || this.name === 'outboxEvents') throw new DOMException('Quota exhausted', 'QuotaExceededError')
      return add.apply(this, args as Parameters<IDBObjectStore['add']>)
    }
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'attendanceDrafts' || this.name === 'outboxEvents') throw new DOMException('Quota exhausted', 'QuotaExceededError')
      return original.apply(this, args as Parameters<IDBObjectStore['put']>)
    }
  })
  await page.getByLabel('Attendance date').fill('2026-09-29')
  await page.getByRole('button', { name: 'Start attendance' }).click()
  await expect(page.getByRole('alert')).toContainText('This change was not saved')
  await expect(page.getByRole('button', { name: 'Finalize attendance' })).toHaveCount(0)
})
