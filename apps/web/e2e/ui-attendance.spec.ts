import { expect, test } from '@playwright/test'
import { bootstrap, deviceRecords, expectNoSeriousAccessibilityIssues, json, mockCsrf, outboxCount, prepareProfile, addProfile } from './support'

// Fresh isolated contexts, synthetic identities and intercepted API only.
test.use({ serviceWorkers: 'block' })
async function capture(page: import('@playwright/test').Page, state: string) {
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({ path: test.info().outputPath(`${state}-${width}.png`), fullPage: true, scale: 'css' })
  }
}
test.beforeEach(async ({ context }) => {
  await mockCsrf(context)
  await context.route('**/api/**', route => json(route, {}, 503))
  await context.route('**/logout', route => route.fulfill({ status: 204 }))
  await context.route('**/api/offline/bootstrap**', route => json(route, bootstrap('11', undefined, new URL(route.request().url()).searchParams.get('device_id')!)))
})

test('view, date changes and Resume never write attendance; deliberate repeated Start creates one encrypted session', async ({ page }) => {
  await prepareProfile(page)
  const before = await deviceRecords(page)
  await page.getByRole('button', { name: 'Open Attendance' }).click()
  await expect(page.getByRole('button', { name: 'Start attendance' })).toBeVisible()
  const localDate = await page.evaluate(() => {
    const value = new Date()
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  })
  await expect(page.getByLabel('Attendance date')).toHaveValue(localDate)
  await page.getByLabel('Attendance date').fill('2026-10-01')
  await expect(page.getByText('No draft for this date')).toBeVisible()
  expect(await deviceRecords(page)).toEqual(before)
  await page.getByRole('button', { name: 'Start attendance' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(page.getByText('Pilot Student A')).toBeVisible()
  expect(await outboxCount(page)).toBe(1)
  await page.getByRole('button', { name: 'Mark Pilot Student A absent' }).click()
  await expect(page.getByRole('button', { name: 'Mark Pilot Student A absent' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => outboxCount(page)).toBe(2)
  const saved = await deviceRecords(page)
  expect(saved.attendanceDrafts).toHaveLength(1)
  expect(JSON.stringify(saved)).not.toMatch(/Pilot Student|student_marked|attendance_date/)
  await page.getByLabel('Attendance date').fill('2026-10-02')
  await expect(page.getByText('No draft for this date')).toBeVisible()
  await page.getByLabel('Attendance date').fill('2026-10-01')
  await expect(page.getByText('Saved draft found')).toBeVisible()
  await page.getByRole('button', { name: 'Resume attendance' }).click()
  await expect(page.getByRole('button', { name: 'Mark Pilot Student A absent' })).toHaveAttribute('aria-pressed', 'true')
  expect(await deviceRecords(page)).toEqual(saved)
})

test('filters, marking and finalization dialogs remain accessible at five widths and enlarged forced colors', async ({ page }) => {
  await addProfile(page)
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `width ${width}`).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`attendance-unmarked-${width}.png`), fullPage: true })
  }
  await expectNoSeriousAccessibilityIssues(page)
  await page.screenshot({ path: test.info().outputPath('attendance-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 900 })
  await page.screenshot({ path: test.info().outputPath('attendance-phone.png'), fullPage: true })
  for (const name of ['Mark all unmarked absent', 'Mark Pilot Student A present', 'Mark Pilot Student B absent']) {
    const control = page.getByRole('button', { name, exact: true })
    await control.focus()
    expect(await control.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return ![...document.querySelectorAll('.attendance-finalize-bar, .phone-navigation')].some(overlay => {
        const cover = overlay.getBoundingClientRect()
        return cover.height > 0 && cover.top <= rect.top && cover.bottom >= rect.bottom
      }) && rect.top >= 0 && rect.bottom <= innerHeight
    }), `${name}: focused control is visible`).toBe(true)
  }
  await page.getByRole('button', { name: 'Mark Pilot Student A present' }).click()
  await page.getByRole('button', { name: 'Present', exact: true }).click()
  await expect(page.getByText('Pilot Student B')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Present', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Mark 1 remaining student first')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Finalize attendance' })).toBeDisabled()
  await page.getByRole('button', { name: 'Unmarked', exact: true }).click()
  await expect(page.getByText('Pilot Student B')).toBeVisible()
  await page.getByRole('button', { name: 'Mark Pilot Student B absent' }).click()
  await page.getByRole('button', { name: 'Absent', exact: true }).click()
  await expect(page.getByText('Pilot Student B')).toBeVisible()
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  await page.addStyleTag({ content: ':root {font-size:200%}' })
  await expect(page.locator('.attendance-finalize-bar')).toHaveCSS('position', 'static')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expectNoSeriousAccessibilityIssues(page)
  const enlargedControl = page.getByRole('button', { name: 'Mark Pilot Student B absent' })
  await enlargedControl.focus()
  expect(await enlargedControl.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const bar = document.querySelector('.attendance-finalize-bar')!.getBoundingClientRect()
    return rect.top >= 0 && rect.bottom <= innerHeight && (rect.bottom <= bar.top || rect.top >= bar.bottom)
  })).toBe(true)
  await page.getByRole('button', { name: 'Finalize attendance' }).click()
  const dialog = page.getByRole('dialog', { name: 'Finalize this session?' })
  await expect(dialog.getByText('2 regular students + 0 guests')).toBeVisible()
  await expectNoSeriousAccessibilityIssues(page)
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Finalize on this device' })).toBeFocused()
  const before = await deviceRecords(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Finalize attendance' })).toBeFocused()
  expect(await deviceRecords(page)).toEqual(before)
  await page.getByRole('button', { name: 'Finalize attendance' }).click()
  await dialog.getByRole('button', { name: 'Finalize on this device' }).click()
  await expect(page.getByText('Finalized on this device')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Pilot Student A present' })).toBeDisabled()
  await page.screenshot({ path: test.info().outputPath('attendance-finalized.png'), fullPage: true })
  await page.screenshot({ path: test.info().outputPath('attendance-enlarged-viewport.png') })
})

test('guest cancellation writes nothing; quota recovery preserves input and encrypted restart preserves saved guest', async ({ page, context }) => {
  await addProfile(page)
  await context.setOffline(true)
  const before = await deviceRecords(page)
  await page.getByRole('button', { name: 'Add temporary guest' }).click()
  await expect(page.getByLabel('Display name')).toBeFocused()
  await page.getByLabel('Display name').fill('Synthetic UI08 guest')
  await page.getByLabel('Gender (optional)').selectOption('female')
  await expectNoSeriousAccessibilityIssues(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add temporary guest' })).toBeFocused()
  expect(await deviceRecords(page)).toEqual(before)
  await page.getByRole('button', { name: 'Add temporary guest' }).click()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'attendanceDrafts') { IDBObjectStore.prototype.put = original; throw new DOMException('Synthetic quota', 'QuotaExceededError') }
      return original.apply(this, args as Parameters<IDBObjectStore['put']>)
    }
  })
  await page.getByRole('button', { name: 'Add guest as present' }).click()
  await expect(page.getByRole('alert')).toContainText('This change was not saved')
  await expect(page.getByLabel('Display name')).toHaveValue('Synthetic UI08 guest')
  await expect(page.getByLabel('Gender (optional)')).toHaveValue('female')
  expect(await deviceRecords(page)).toEqual(before)
  await capture(page, 'guest-write-failure')
  await page.getByRole('button', { name: 'Add guest as present' }).click()
  await expect(page.getByText('Synthetic UI08 guest', { exact: true })).toBeVisible()
  await expect.poll(() => outboxCount(page)).toBe(2)
  const saved = await deviceRecords(page)
  expect(JSON.stringify(saved)).not.toContain('Synthetic UI08 guest')
  // Fresh page restart clears the in-memory key. Unlock the same profile; Resume is read-only.
  await page.close()
  await context.setOffline(false)
  const reopened = await context.newPage()
  await reopened.goto('/profiles')
  await context.setOffline(true)
  if (!await reopened.getByLabel('Local PIN', { exact: true }).count()) await reopened.getByRole('button', { name: 'Use profile 1' }).click()
  await reopened.getByLabel('Local PIN', { exact: true }).fill('184629')
  await reopened.getByRole('button', { name: 'Unlock Profile 1', exact: true }).click()
  await expect(reopened.getByRole('button', { name: 'Resume attendance' })).toBeEnabled()
  const unlocked = await deviceRecords(reopened)
  // Unlock may update authorization metadata; it must preserve the original key,
  // bindings and all encrypted payloads. Resume itself must change no store.
  for (const table of ['attendanceDrafts', 'outboxEvents', 'encryptedBlobs', 'conflicts']) expect(unlocked[table]).toEqual(saved[table])
  for (const key of ['id', 'actorId', 'churchId', 'deviceId', 'salt', 'wrappedDataKey']) expect(unlocked.profiles[0][key]).toEqual(saved.profiles[0][key])
  await reopened.getByRole('button', { name: 'Resume attendance' }).click()
  await expect(reopened.getByText('Synthetic UI08 guest', { exact: true })).toBeVisible()
  expect(await deviceRecords(reopened)).toEqual(unlocked)
})

test('full long names, compact marking and keyboard dialogs reflow without changing saved work', async ({ page, context }) => {
  const student = 'SyntheticLongStudentName'.repeat(4), ministry = 'Synthetic ministry with a long name '.repeat(3).trim()
  await context.route('**/api/offline/bootstrap**', route => {
    const value = bootstrap('11', undefined, new URL(route.request().url()).searchParams.get('device_id')!)
    value.roster[0].display_name = student; value.ministries[0].name = ministry
    return json(route, value)
  })
  await addProfile(page)
  for (const width of [320, 360, 390, 768, 1024, 1440, 1548]) {
    await page.setViewportSize({ width, height: width === 1548 ? 1016 : 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `long names at ${width}`).toBe(true)
    await expect(page.getByRole('button', { name: `Mark ${student} present` })).toBeVisible()
    expect(await page.locator('.attendance-state-controls button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44))).toBe(true)
    if (width >= 1024) {
      const geometry = await page.locator('.attendance-screen').evaluate(element => {
        const page = element.getBoundingClientRect(), context = element.querySelector('.attendance-session-panel')!.getBoundingClientRect(), roster = element.querySelector('.attendance-roster-panel')!.getBoundingClientRect()
        return { width: page.width, x: page.x, contextWidth: context.width, rosterWidth: roster.width, sameTop: context.y === roster.y, sideBySide: roster.x > context.right }
      })
      expect(geometry.sameTop && geometry.sideBySide).toBe(true)
      expect(geometry.rosterWidth).toBeGreaterThan(geometry.contextWidth * 2)
    }
  }
  const before = await deviceRecords(page)
  await page.getByLabel('Search roster').fill('Pilot Student B')
  await page.getByRole('button', { name: 'Unmarked', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Finalize attendance' })).toBeDisabled()
  expect(await deviceRecords(page)).toEqual(before)
  await page.setViewportSize({ width: 320, height: 640 })
  await page.addStyleTag({ content: ':root {font-size:200%}' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Add temporary guest' }).click()
  await expect(page.getByLabel('Display name')).toBeFocused()
  await page.getByLabel('Display name').fill('Synthetic keyboard guest')
  await expectNoSeriousAccessibilityIssues(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Add temporary guest' })).toBeFocused()
  expect(await deviceRecords(page)).toEqual(before)
  await page.screenshot({ path: test.info().outputPath('long-names-enlarged.png'), fullPage: true, scale: 'css' })
})

for (const width of [320, 390]) test(`keyboard focus and outlines stay inside the usable attendance viewport at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await addProfile(page)
  await page.getByRole('button', { name: 'Mark Pilot Student A present' }).click()
  await expect(page.getByRole('button', { name: 'Mark Pilot Student A present' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Mark Pilot Student B absent' }).click()
  await expect(page.getByRole('button', { name: 'Finalize attendance' })).toBeEnabled()
  const saved = await deviceRecords(page)
  const search = page.getByLabel('Search roster')
  const input = await search.elementHandle()
  const measurements: unknown[] = []
  async function visible(control: import('@playwright/test').Locator, modal = false) {
    await expect(control).toBeFocused()
    await expect.poll(() => control.evaluate((element, modal) => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
      const outline = parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset))
      const viewport = window.visualViewport
      const top = viewport?.offsetTop ?? 0, bottom = top + (viewport?.height ?? innerHeight)
      const nav = document.querySelector('.phone-navigation')?.getBoundingClientRect()
      const bar = document.querySelector('.attendance-finalize-bar')
      const cover = bar && !bar.contains(element) ? bar.getBoundingClientRect() : null
      return rect.top - outline >= top && rect.bottom + outline <= bottom
        && (modal || !nav?.height || rect.bottom + outline <= nav.top || rect.top - outline >= nav.bottom)
        && (modal || !cover?.height || rect.bottom + outline <= cover.top || rect.top - outline >= cover.bottom)
    }, modal)).toBe(true)
    measurements.push(await control.evaluate(element => ({ id: element.id, name: element.getAttribute('aria-label') || element.textContent, rect: element.getBoundingClientRect().toJSON(), scrollY, viewport: [innerWidth, innerHeight], outline: getComputedStyle(element).outline, offset: getComputedStyle(element).outlineOffset })))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  for (const height of [900, 420]) {
    await page.setViewportSize({ width, height })
    // Reproduce the original scroll through the marking/actions before returning
    // to search. Both actual keyboard directions retain full-outline assertions.
    for (const name of ['Mark Pilot Student A present', 'Mark Pilot Student B absent', 'Add temporary guest', 'Finalize attendance']) {
      const control = page.getByRole('button', { name })
      await control.focus(); await visible(control)
    }
    await search.focus(); await visible(search)
    await search.fill('Pilot')
    await page.keyboard.press('Tab')
    await visible(page.getByRole('button', { name: 'All', exact: true }))
    await page.keyboard.press('Shift+Tab'); await visible(search)
    expect(await input!.evaluate(element => element === document.activeElement)).toBe(true)
    await expect(search).toHaveValue('Pilot')
    await page.screenshot({ path: test.info().outputPath(`search-focus-${width}-${height}.png`) })
    const guest = page.getByRole('button', { name: 'Add temporary guest' })
    await guest.click()
    await visible(page.getByLabel('Display name'), true)
    await page.keyboard.press('Escape'); await visible(guest)
    const finalize = page.getByRole('button', { name: 'Finalize attendance' })
    await finalize.click()
    await visible(page.getByRole('heading', { name: 'Finalize this session?' }), true)
    await page.keyboard.press('Tab'); await visible(page.getByRole('button', { name: 'Keep editing' }), true)
    await page.keyboard.press('Shift+Tab'); await visible(page.getByRole('button', { name: 'Finalize on this device' }), true)
    await page.keyboard.press('Escape'); await visible(finalize)
    expect(await deviceRecords(page)).toEqual(saved)
    await expectNoSeriousAccessibilityIssues(page)
  }
  await page.addStyleTag({ content: ':root {font-size:200%}' })
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  await search.focus(); await visible(search)
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await visible(search)
  expect(await deviceRecords(page)).toEqual(saved)
  await expectNoSeriousAccessibilityIssues(page)
  await test.info().attach('focus-clearance-geometry', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
})
