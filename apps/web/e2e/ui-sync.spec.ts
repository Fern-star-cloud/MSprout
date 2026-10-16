import { expect, test, type Page, type BrowserContext, type Locator } from '@playwright/test'
import { bootstrap, churchId, ministryId, studentIds, json, mockCsrf, prepareProfile, addProfile, outboxCount, expectNoSeriousAccessibilityIssues } from './support'

// This synthetic API fixture must remain intercepted; service-worker fetches can
// bypass Playwright routes in WebKit. Offline/SW behavior has its own real-PWA tests.
test.use({ serviceWorkers: 'block' })

for (const width of [320, 390]) test(`Sync PIN and recovery focus clear phone navigation at ${width}px`, async ({ page, context }) => {
  await setup(context)
  let transfers = 0
  await context.route('**/api/sync/**', route => { transfers++; return json(route, {}, 503) })
  await page.setViewportSize({ width, height: 900 })
  await addSavedAttendance(page)
  const original = await records(page)
  await page.goto('/account/sync')
  await expect(page.getByText('Matching account verified')).toBeVisible()
  const pin = page.getByLabel('Existing local PIN', { exact: true })
  const unlock = page.getByRole('button', { name: 'Unlock existing profile', exact: true })
  async function visible(control: Locator, field = false) {
    await expect(control).toBeFocused()
    // Sample after native focus and the screen's scheduled reveal, not a transient
    // pre-scroll position that happens to satisfy the bounds for one frame.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))))
    try { await expect.poll(() => control.evaluate((element, field) => {
      const rect = element.getBoundingClientRect(), css = getComputedStyle(element)
      const outline = parseFloat(css.outlineWidth) + Math.max(0, parseFloat(css.outlineOffset))
      const viewport = visualViewport, top = viewport?.offsetTop ?? 0
      const nav = document.querySelector('.phone-navigation')?.getBoundingClientRect()
      const bottom = Math.min(top + (viewport?.height ?? innerHeight), nav?.height ? nav.top : Infinity)
      const group = field ? element.closest('.ui-field')!.getBoundingClientRect() : rect
      return rect.top - outline >= top && rect.bottom + outline <= bottom && group.top >= top && group.bottom <= bottom
    }, field)).toBe(true) } catch (error) {
      await test.info().attach('failed-Sync-clearance', { body: JSON.stringify(await control.evaluate(element => ({ rect: element.getBoundingClientRect().toJSON(), field: element.closest('.ui-field')?.getBoundingClientRect().toJSON(), nav: document.querySelector('.phone-navigation')?.getBoundingClientRect().toJSON(), outline: getComputedStyle(element).outline, offset: getComputedStyle(element).outlineOffset, visual: { top: visualViewport?.offsetTop, height: visualViewport?.height } }))), contentType: 'application/json' })
      await page.screenshot({ path: test.info().outputPath('failed-clearance.png') })
      throw error
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  for (const height of [420, 900]) {
    await page.setViewportSize({ width, height })
    await pin.focus(); await visible(pin, true)
    await expect(pin).toHaveAttribute('type', 'password')
    await expect(pin).toHaveAttribute('pattern', '[0-9]{6,12}')
    await page.screenshot({ path: test.info().outputPath(`pin-${width}-${height}.png`) })
    await page.keyboard.press('Tab'); await visible(unlock)
    await page.keyboard.press('Shift+Tab'); await visible(pin, true)
  }
  await page.setViewportSize({ width, height: 420 })
  await pin.fill('999999'); await unlock.click()
  await expect(pin).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('The existing local PIN is incorrect. Encrypted work is unchanged.')).toBeVisible()
  await pin.focus(); await visible(pin, true)
  await page.screenshot({ path: test.info().outputPath(`pin-error-${width}-420.png`) })
  await expectNoSeriousAccessibilityIssues(page)
  // A wrong PIN may update only the existing profile's retry metadata.
  const failed = await records(page)
  expect({ ...failed, profiles: original.profiles }).toEqual(original)
  expect(failed.profiles).toEqual(original.profiles.map(profile => ({ ...profile, failedAttempts: Number(profile.failedAttempts) + 1, retryAfter: expect.any(String) })))
  expect(failed.profiles[0].wrappedDataKey).toEqual(original.profiles[0].wrappedDataKey)
  await expect(unlock).toBeEnabled()
  await pin.fill('184629'); await unlock.click()
  const continuation = page.getByRole('button', { name: 'Continue synchronization', exact: true })
  await expect(continuation).toBeEnabled(); await visible(continuation)
  await page.keyboard.press('Tab'); await visible(page.getByRole('button', { name: 'Lock profile', exact: true }))
  await page.keyboard.press('Shift+Tab'); await visible(continuation)
  await page.getByRole('button', { name: 'Lock profile', exact: true }).click()
  await pin.focus(); await visible(pin, true)
  await page.keyboard.press('Tab'); await visible(unlock)
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  await page.addStyleTag({ content: ':root {font-size:200%}' })
  await page.keyboard.press('Shift+Tab')
  await test.info().attach('enlarged-PIN-geometry', { body: JSON.stringify(await pin.evaluate(element => ({ input: element.getBoundingClientRect().toJSON(), field: element.closest('.ui-field')!.getBoundingClientRect().toJSON(), nav: document.querySelector('.phone-navigation')!.getBoundingClientRect().toJSON() }))), contentType: 'application/json' })
  // At 200% text the 320px field group is taller than the space above navigation.
  // Keep the complete focused control visible and prove its context is scrollable.
  await visible(pin)
  for (const description of [page.locator('label[for="sync-existing-pin"]'), page.locator('#sync-existing-pin-hint')]) {
    await description.evaluate(element => window.scrollBy({ top: element.getBoundingClientRect().top - (visualViewport?.offsetTop ?? 0) - 8, behavior: 'instant' }))
    await expect.poll(() => description.evaluate(element => {
      const rect = element.getBoundingClientRect(), viewport = visualViewport
      return rect.top >= (viewport?.offsetTop ?? 0) && rect.bottom <= Math.min((viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight), document.querySelector('.phone-navigation')!.getBoundingClientRect().top)
    })).toBe(true)
  }
  await page.keyboard.press('Tab'); await visible(unlock)
  await page.keyboard.press('Shift+Tab'); await visible(pin)
  await pin.fill('999999'); await unlock.click()
  await expect(pin).toHaveAttribute('aria-invalid', 'true')
  await pin.focus(); await visible(pin)
  const feedback = page.locator('#sync-existing-pin-error')
  await feedback.evaluate(element => window.scrollBy({ top: element.getBoundingClientRect().top - (visualViewport?.offsetTop ?? 0) - 8, behavior: 'instant' }))
  await expect.poll(() => feedback.evaluate(element => {
    const rect = element.getBoundingClientRect(), viewport = visualViewport
    return rect.top >= (viewport?.offsetTop ?? 0) && rect.bottom <= Math.min((viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight), document.querySelector('.phone-navigation')!.getBoundingClientRect().top)
  })).toBe(true)
  await page.screenshot({ path: test.info().outputPath(`pin-enlarged-error-${width}-420.png`) })
  await expect(unlock).toBeEnabled()
  await pin.fill('184629'); await unlock.click()
  await expect(continuation).toBeEnabled(); await visible(continuation)
  await page.getByRole('button', { name: 'Lock profile', exact: true }).click()
  await expectNoSeriousAccessibilityIssues(page)
  const final = await records(page)
  expect(final).toEqual(original)
  expect(final.profiles[0].wrappedDataKey).toEqual(original.profiles[0].wrappedDataKey)
  expect(transfers).toBe(0)
})

async function capture(page: Page, state: string, widths = [390, 768, 1440, 1548]) {
  for (const width of [...new Set([1440, 1024, 768, 390, 320, ...widths])]) {
    await page.setViewportSize({ width, height: width === 1548 ? 1016 : 900 })
    await page.evaluate(() => scrollTo(0, 0))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${state} at ${width}`).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`${state}-${width}.png`), fullPage: true })
    await page.screenshot({ path: test.info().outputPath(`${state}-${width}-viewport.png`) })
    const geometry = await page.locator('.sync-screen').evaluate(element => {
      const selectors = ['.sync-panel', '.sync-summary', '.sync-stage', '.sync-actions .ui-button', '.sync-heading h1', '.sync-summary h2', '.sync-stage h3', '.sync-stage p', '.sync-guidance']
      return Object.fromEntries(selectors.map(selector => [selector, [...element.querySelectorAll<HTMLElement>(selector)].map(node => {
        const rect = node.getBoundingClientRect(), css = getComputedStyle(node)
        return { width: rect.width, height: rect.height, x: rect.x, y: rect.y, font: css.fontFamily, size: css.fontSize, weight: css.fontWeight, lineHeight: css.lineHeight, padding: css.padding, gap: css.gap, color: css.color, background: css.background, radius: css.borderRadius }
      })]))
    })
    await test.info().attach(`${state}-${width}-geometry`, { body: JSON.stringify(geometry), contentType: 'application/json' })
  }
}

async function records(page: Page): Promise<Record<string, Record<string, unknown>[]>> {
  return page.evaluate(async () => {
    const request = indexedDB.open('ministry-sprout-offline')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    try {
      const names = [...db.objectStoreNames], tx = db.transaction(names)
      return Object.fromEntries(await Promise.all(names.map(name => new Promise<[string, Record<string, unknown>[]]>((resolve, reject) => {
        const read = tx.objectStore(name).getAll(); read.onsuccess = () => resolve([name, read.result]); read.onerror = () => reject(read.error)
      }))))
    } finally { db.close() }
  })
}

async function setup(context: BrowserContext) {
  let bootstraps = 0
  await mockCsrf(context)
  await context.route('**/api/**', route => json(route, {}, 503))
  await context.route('**/auth/session', route => json(route, { id: 11, email_verified: true, mfa_confirmed: false, workspaces: [{ church_id: churchId, name: 'Synthetic Church', role: 'teacher' }] }))
  await context.route('**/api/me', route => json(route, { id: 11, email_verified: true, active_session: { mfa_confirmed: false }, memberships: [{ church_id: churchId, role: 'teacher', status: 'active' }], assignments: { ministry_ids: [ministryId] } }))
  await context.route('**/api/ministries', route => json(route, { data: [{ id: ministryId, name: 'Primary', status: 'active', version: 1 }] }))
  await context.route('**/api/offline/bootstrap**', route => json(route, { ...bootstrap('11', undefined, new URL(route.request().url()).searchParams.get('device_id')!), server_cursor: bootstraps++ === 0 ? '0' : '999' }))
  await context.route('**/api/sync-conflicts', route => json(route, { needs_owner_review: false }))
}

async function openAndUnlock(page: Page, pin = '184629') {
  await page.goto('/account/sync')
  await expect(page.getByText('Matching account verified')).toBeVisible()
  await page.getByLabel('Existing local PIN').fill(pin)
  await page.getByRole('button', { name: 'Unlock existing profile' }).click()
  await expect(page.getByText('Unlocked on this device — authorization checked separately')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue synchronization' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Continue synchronization' })).toBeFocused()
}

async function addSavedAttendance(page: Page) {
  await addProfile(page)
  // The heading can render while initial encrypted draft persistence is pending.
  // Establish the fixture's durable work before navigating or taking its baseline.
  await expect.poll(() => outboxCount(page)).toBe(1)
}

test('approved Sync navigation and read-only status preserve every store at five widths', async ({ page, context }) => {
  await setup(context)
  let syncRequests = 0, logouts = 0
  await context.route('**/api/sync/**', route => { syncRequests++; return json(route, {}, 503) })
  await context.route('**/logout', route => { logouts++; return route.fulfill({ status: 204 }) })
  await prepareProfile(page, '001234')
  const before = await records(page)
  await page.locator('a[href^="/account/sync"]:visible').first().click()
  await expect(page.getByRole('heading', { name: 'Sync & device', exact: true })).toBeVisible()
  await expect(page.getByText('0 pending uploads')).toBeVisible()
  await page.getByRole('button', { name: 'Check device status' }).click()
  await expect(page.getByText('Device status checked. No synchronization or attendance was started.')).toBeVisible()
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `width ${width}`).toBe(true)
  }
  expect(await records(page)).toEqual(before)
  expect(syncRequests).toBe(0); expect(logouts).toBe(0)
  await expectNoSeriousAccessibilityIssues(page)
  await capture(page, 'unknown-downloads', [320, 360, 390, 768, 1024, 1440, 1548])
  await page.evaluate(() => scrollTo(0, 0))
  await page.screenshot({ path: test.info().outputPath('sync-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  await page.addStyleTag({ content: ':root {font-size:200%}' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expectNoSeriousAccessibilityIssues(page)
  await page.evaluate(() => scrollTo(0, 0))
  await page.screenshot({ path: test.info().outputPath('sync-enlarged.png'), fullPage: true })
})

test('direct original PIN unlock never logs out, transfers or creates attendance; lock hides counts', async ({ page, context }) => {
  await setup(context)
  let syncRequests = 0, logouts = 0
  await context.route('**/api/sync/**', route => { syncRequests++; return json(route, {}, 503) })
  await context.route('**/logout', route => { logouts++; return route.fulfill({ status: 204 }) })
  await prepareProfile(page, '001234')
  const original = await records(page)
  await openAndUnlock(page, '001234')
  const after = await records(page)
  expect(after).toEqual(original)
  expect(syncRequests).toBe(0); expect(logouts).toBe(0)
  await page.getByRole('button', { name: 'Lock profile', exact: true }).click()
  await expect(page.getByText('Locked — encrypted work retained')).toBeVisible()
  expect(await page.locator('body').ariaSnapshot()).not.toContain('0 pending uploads')
  expect(await records(page)).toEqual(original)
  await page.getByLabel('Existing local PIN').focus()
  await expect(page.getByLabel('Existing local PIN')).toBeFocused()
  await expectNoSeriousAccessibilityIssues(page)
  await capture(page, 'locked', [390, 1440])
})

test('accepted uploads with interrupted pagination retain zero/incomplete and resume without reupload', async ({ page, context }) => {
  await setup(context)
  let failed = true, pushes = 0, logouts = 0
  const pulls: string[] = []
  await context.route('**/logout', route => { logouts++; return route.fulfill({ status: 204 }) })
  await context.route('**/api/sync/push', route => {
    pushes++
    const body = route.request().postDataJSON() as { events: Array<{ client_event_id: string }> }
    return json(route, { results: body.events.map((event, index) => ({ ...event, status: 'accepted', version: index + 1 })) })
  })
  await context.route('**/api/sync/pull**', route => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor')!; pulls.push(cursor)
    if (cursor === '2' && failed) return json(route, {}, 503)
    return json(route, { changes: [], page: { next_cursor: cursor === '0' ? '2' : '4', has_more: cursor === '0' }, lease: bootstrap('11', undefined, route.request().headers()['x-device-id']).lease })
  })
  await addSavedAttendance(page)
  await page.getByRole('button', { name: 'Mark Pilot Student A present' }).click()
  await expect(page.getByText(/2 pending/)).toBeVisible()
  const before = await records(page)
  await openAndUnlock(page)
  await page.getByRole('button', { name: 'Continue synchronization' }).dblclick()
  await expect(page.getByText(/Synchronization incomplete\. Uploaded changes may already be accepted/)).toBeVisible()
  await expect(page.getByText('0 pending uploads')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Downloads incomplete', exact: true })).toBeVisible()
  const interrupted = await records(page)
  expect(interrupted.serverCursors[0].cursor).toBe('2')
  expect(interrupted.profiles[0].syncNeedsPull).toBe(true)
  expect(interrupted.profiles[0].wrappedDataKey).toEqual(before.profiles[0].wrappedDataKey)
  expect(interrupted.attendanceDrafts).toEqual(before.attendanceDrafts)
  await capture(page, 'interrupted-incomplete')
  failed = false
  await page.reload(); await expect(page.getByText('Matching account verified')).toBeVisible()
  await page.getByLabel('Existing local PIN').fill('184629'); await page.getByRole('button', { name: 'Unlock existing profile' }).click()
  await expect(page.getByText('0 pending uploads')).toBeVisible()
  await capture(page, 'incomplete-downloads')
  await page.getByRole('button', { name: 'Continue synchronization' }).click()
  await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toBeVisible()
  const after = await records(page)
  expect(after.serverCursors[0].cursor).toBe('4'); expect(after.profiles[0].syncNeedsPull).toBe(false)
  expect(after.profiles[0].wrappedDataKey).toEqual(before.profiles[0].wrappedDataKey)
  expect(after.attendanceDrafts).toEqual(before.attendanceDrafts)
  expect(await outboxCount(page)).toBe(0); expect(pushes).toBe(1); expect(logouts).toBe(0)
  expect(pulls).toEqual(['0', '2', '2', '2', '2'])
  await expect(page).toHaveURL(/\/account\/sync$/)
  await expectNoSeriousAccessibilityIssues(page)
  await capture(page, 'complete')
})

test('lost server responses reconcile the original event IDs and never recreate accepted work', async ({ page, context }) => {
  await setup(context)
  let lost = true
  const accepted = new Set<string>(), submissions: string[][] = []
  await context.route('**/api/sync/push', route => {
    const events = (route.request().postDataJSON() as { events: Array<{ client_event_id: string }> }).events
    const ids = events.map(event => event.client_event_id); submissions.push(ids)
    if (lost) { ids.forEach(id => accepted.add(id)); return route.abort('failed') }
    return json(route, { results: ids.map(id => ({ client_event_id: id, status: 'duplicate', original_status: 'accepted', version: 1 })) })
  })
  await context.route('**/api/sync/pull**', route => json(route, { changes: [], page: { next_cursor: '4', has_more: false }, lease: bootstrap('11', undefined, route.request().headers()['x-device-id']).lease }))
  await addSavedAttendance(page); const before = await records(page)
  await openAndUnlock(page); await page.getByRole('button', { name: 'Continue synchronization' }).click()
  await expect(page.getByText(/Synchronization incomplete\. Uploaded changes may already be accepted/)).toBeVisible()
  expect(await outboxCount(page)).toBe(1)
  expect(submissions).toHaveLength(3)
  await capture(page, 'uncertain-response', [390, 1440])
  lost = false
  await page.getByRole('button', { name: 'Continue synchronization' }).click()
  await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue synchronization' }).click()
  await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toBeVisible()
  expect(submissions).toHaveLength(4)
  expect(submissions.every(ids => JSON.stringify(ids) === JSON.stringify(submissions[0]))).toBe(true)
  expect(accepted.size).toBe(1); expect(await outboxCount(page)).toBe(0)
  expect((await records(page)).attendanceDrafts).toEqual(before.attendanceDrafts)
})

test('quarantined work remains visible after transfer and reload without revealing Teacher provenance', async ({ page, context }) => {
  await setup(context)
  await context.route('**/api/sync-conflicts', route => json(route, { needs_owner_review: true }))
  await context.route('**/api/sync/push', route => {
    const events = (route.request().postDataJSON() as { events: Array<{ client_event_id: string }> }).events
    return json(route, { results: events.map(event => ({ ...event, status: 'conflict', reason: 'stale_version', version: 2 })) })
  })
  await context.route('**/api/sync/pull**', route => json(route, { changes: [], page: { next_cursor: '4', has_more: false }, lease: bootstrap('11', undefined, route.request().headers()['x-device-id']).lease }))
  await addSavedAttendance(page); await openAndUnlock(page)
  await page.getByRole('button', { name: 'Continue synchronization' }).click()
  await expect(page.getByRole('heading', { name: 'Transfers complete — review remains' })).toBeVisible()
  await expect(page.getByText('1 quarantined item retained on this device')).toBeVisible()
  await expect(page.getByText('Server work needs Owner review')).toBeVisible()
  await capture(page, 'review-remaining', [390, 768, 1440])
  const before = await records(page)
  expect(before.conflicts).toHaveLength(1)
  expect(await page.locator('body').ariaSnapshot()).not.toContain('Pilot Student')
  await openAndUnlock(page)
  await expect(page.getByText('1 quarantined item retained on this device')).toBeVisible()
  expect((await records(page)).conflicts).toEqual(before.conflicts)
  await expectNoSeriousAccessibilityIssues(page)
})

test('denied pull preserves accepted work and blocks protected status until same-profile authorization returns', async ({ page, context }) => {
  await setup(context)
  let deny = true, pushes = 0
  await context.route('**/api/sync/push', route => {
    pushes++
    const events = (route.request().postDataJSON() as { events: Array<{ client_event_id: string }> }).events
    return json(route, { results: events.map(event => ({ ...event, status: 'accepted', version: 1 })) })
  })
  await context.route('**/api/sync/pull**', route => deny ? json(route, {}, 403) : json(route, { changes: [], page: { next_cursor: '4', has_more: false }, lease: bootstrap('11', undefined, route.request().headers()['x-device-id']).lease }))
  await addSavedAttendance(page); const original = await records(page)
  await openAndUnlock(page); await page.getByRole('button', { name: 'Continue synchronization' }).click()
  await expect(page.getByText('Account verification required')).toBeVisible()
  await expect(page.getByText('Upload count unavailable')).toBeVisible()
  expect(await outboxCount(page)).toBe(0)
  const denied = await records(page)
  expect(denied.profiles[0].wrappedDataKey).toEqual(original.profiles[0].wrappedDataKey)
  expect(denied.profiles[0].requiresReauthentication).toBe(true)
  expect(denied.attendanceDrafts).toEqual(original.attendanceDrafts)
  deny = false
  await page.getByRole('button', { name: 'Verify account access' }).click()
  await page.getByRole('button', { name: 'Continue synchronization' }).click()
  await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toBeVisible()
  expect(pushes).toBe(1); expect((await records(page)).attendanceDrafts).toEqual(original.attendanceDrafts)
  await expectNoSeriousAccessibilityIssues(page)
})

test('expired account sessions require verification before original unlock and never start transfer on return', async ({ page, context }) => {
  await setup(context)
  let syncRequests = 0
  await context.route('**/api/sync/**', route => { syncRequests++; return json(route, {}, 503) })
  await prepareProfile(page)
  const original = await records(page)
  const expired = (route: Parameters<typeof json>[0]) => json(route, {}, 419)
  await context.route('**/auth/session', expired)
  await page.goto('/account/sync')
  await expect(page.getByText('Account verification required')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unlock existing profile' })).toBeDisabled()
  await capture(page, 'expired-account', [390, 1440])
  expect(await records(page)).toEqual(original)
  await context.unroute('**/auth/session', expired)
  await page.getByRole('button', { name: 'Verify account access' }).click()
  await expect(page.getByText('Matching account verified')).toBeVisible()
  await page.getByLabel('Existing local PIN').fill('184629')
  await page.getByRole('button', { name: 'Unlock existing profile' }).click()
  await expect(page.getByRole('button', { name: 'Continue synchronization' })).toBeEnabled()
  expect(syncRequests).toBe(0); expect(await records(page)).toEqual(original)
  await expectNoSeriousAccessibilityIssues(page)
})

test('downloaded needs-review sessions remain visible with no queued or quarantined events', async ({ page, context }) => {
  await setup(context)
  await addSavedAttendance(page)
  const original = await records(page), draftId = original.attendanceDrafts[0].id
  const attendanceDate = await page.getByLabel('Attendance date', { exact: true }).inputValue()
  await context.route('**/api/sync/push', route => {
    const events = (route.request().postDataJSON() as { events: Array<{ client_event_id: string }> }).events
    return json(route, { results: events.map(event => ({ ...event, status: 'accepted', version: 1 })) })
  })
  await context.route('**/api/sync/pull**', route => json(route, { changes: [{ sequence: '4', entity_type: 'attendance_session', entity_id: draftId, version: 2, action: 'upsert', ministry_id: ministryId,
    payload: { id: draftId, ministry_id: ministryId, attendance_date: attendanceDate, version: 2, status: 'needs_review', guests: [],
      records: studentIds.map((id, index) => ({ id: `00000000-0000-4000-8000-00000000040${index}`, student_id: id, state: index === 0 ? 'present' : 'unmarked', version: 1 })) },
  }], page: { next_cursor: '4', has_more: false }, lease: bootstrap('11', undefined, route.request().headers()['x-device-id']).lease }))
  await openAndUnlock(page); await page.getByRole('button', { name: 'Continue synchronization' }).click()
  await expect(page.getByRole('heading', { name: 'Transfers complete — review remains' })).toBeVisible()
  await expect(page.getByText('1 downloaded session needs review')).toBeVisible()
  await expect(page.getByText('0 pending uploads')).toBeVisible()
  await expect(page.getByText('0 quarantined items retained on this device')).toBeVisible()
  const reviewed = await records(page)
  await page.getByRole('button', { name: 'Check device status' }).click()
  await expect(page.getByText(/Device status checked/)).toBeVisible()
  expect(await records(page)).toEqual(reviewed)
  await openAndUnlock(page)
  await expect(page.getByText('1 downloaded session needs review')).toBeVisible()
  expect(await records(page)).toEqual(reviewed)
})

test('checking status with pending work announces a read, never an upload or download operation', async ({ page, context }) => {
  await setup(context)
  let hold = false, release: (() => void) | undefined, syncRequests = 0
  await context.route('**/api/sync/**', route => { syncRequests++; return json(route, {}, 503) })
  await context.route('**/api/sync-conflicts', async route => {
    if (hold) await new Promise<void>(resolve => { release = resolve })
    await json(route, { needs_owner_review: false })
  })
  await addSavedAttendance(page)
  await page.getByRole('button', { name: 'Mark Pilot Student A present' }).click()
  await expect(page.getByText(/2 pending/)).toBeVisible()
  await openAndUnlock(page)
  await expect(page.getByText('2 pending uploads')).toBeVisible()
  const before = await records(page)
  hold = true
  await page.getByRole('button', { name: 'Check device status' }).click()
  await expect.poll(() => release !== undefined).toBe(true)
  await expect(page.getByRole('heading', { name: 'Checking device status…' })).toBeVisible()
  await expect(page.getByText(/Sending saved changes/)).toHaveCount(0)
  await expect(page.getByText('In progress or awaiting authorization — not complete')).toHaveCount(0)
  expect(syncRequests).toBe(0); expect(await records(page)).toEqual(before)
  hold = false; release!()
  await expect(page.getByRole('heading', { name: 'Saved locally — pending upload' })).toBeVisible()
  await expectNoSeriousAccessibilityIssues(page)
})

test('Pack 04 presents pending, offline, upload and download waits with accessible safe actions', async ({ page, context }) => {
  await setup(context)
  let releasePush: (() => void) | undefined, releasePull: (() => void) | undefined
  await context.route('**/api/sync/push', async route => {
    await new Promise<void>(resolve => { releasePush = resolve })
    const events = (route.request().postDataJSON() as { events: Array<{ client_event_id: string }> }).events
    await json(route, { results: events.map(event => ({ ...event, status: 'accepted', version: 1 })) })
  })
  await context.route('**/api/sync/pull**', async route => {
    await new Promise<void>(resolve => { releasePull = resolve })
    await json(route, { changes: [], page: { next_cursor: '4', has_more: false }, lease: bootstrap('11', undefined, route.request().headers()['x-device-id']).lease })
  })
  await addSavedAttendance(page); await openAndUnlock(page)
  const before = await records(page)
  await capture(page, 'pending', [320, 360, 390, 768, 975, 1024, 1440, 1548])
  await context.setOffline(true)
  await expect(page.getByRole('heading', { name: 'Saved on this device', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue synchronization' })).toBeDisabled()
  await capture(page, 'offline-pending', [390, 768, 1440])
  expect(await records(page)).toEqual(before)
  await context.setOffline(false)
  await expect(page.getByText('Matching account verified')).toBeVisible()
  await page.getByRole('button', { name: 'Continue synchronization' }).click()
  await expect.poll(() => releasePush !== undefined).toBe(true)
  await expect(page.getByRole('button', { name: 'Continue synchronization' })).toBeDisabled()
  await capture(page, 'uploading', [390, 1440])
  await expectNoSeriousAccessibilityIssues(page)
  releasePush!()
  await expect.poll(() => releasePull !== undefined).toBe(true)
  await expect(page.getByText('0 pending uploads')).toBeVisible()
  await capture(page, 'downloading', [390, 1440])
  await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toHaveCount(0)
  releasePull!()
  await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Existing device profile' }).focus()
  for (const name of ['Continue synchronization', 'Lock profile', 'Verify account access', 'Check device status']) {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name, exact: true })).toBeFocused()
  }
  await page.keyboard.press('Tab')
  await expect(page.locator('.sync-guidance summary')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/Keep this profile and browser storage/)).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addStyleTag({ content: ':root {font-size:200%}' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expectNoSeriousAccessibilityIssues(page)
})

test('unavailable storage and server review stay unknown and retain synthetic work', async ({ page, context }) => {
  await setup(context)
  await context.route('**/api/sync/pull**', route => json(route, { changes: [], page: { next_cursor: '4', has_more: false }, lease: bootstrap('11', undefined, route.request().headers()['x-device-id']).lease }))
  await prepareProfile(page); await openAndUnlock(page)
  await context.route('**/api/sync-conflicts', route => json(route, {}, 503))
  await page.getByRole('button', { name: 'Continue synchronization' }).click()
  await expect(page.getByRole('heading', { name: 'Transfers complete — server review unknown' })).toBeVisible()
  await capture(page, 'server-review-unknown', [390, 1440])
  const before = await records(page)
  // Inject only a read failure in this disposable browser; stored bytes stay intact.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get
    Object.defineProperty(window, 'restoreSyntheticRead', { configurable: true, value: () => { IDBObjectStore.prototype.get = original } })
    IDBObjectStore.prototype.get = function (key) {
      if (this.name === 'profiles') throw new DOMException('Synthetic storage read unavailable', 'UnknownError')
      return original.call(this, key)
    }
  })
  await page.getByRole('button', { name: 'Check device status' }).click()
  await expect(page.getByText('Upload count unavailable')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toHaveCount(0)
  await capture(page, 'storage-unknown', [390, 768, 1440])
  await expectNoSeriousAccessibilityIssues(page)
  await page.evaluate(() => { (window as unknown as { restoreSyntheticRead(): void }).restoreSyntheticRead() })
  expect(await records(page)).toEqual(before)
})
