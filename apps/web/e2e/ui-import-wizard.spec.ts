import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { churchId, ministryId, mockCsrf, mockOwner, json, expectNoSeriousAccessibilityIssues, deviceRecords } from './support'

test.use({ serviceWorkers: 'block' })
const batch = '00000000-0000-4000-8000-000000000090'
const ids = [91, 92, 93, 94].map(index => `00000000-0000-4000-8000-0000000000${index}`)
const rows = ids.map((id, index) => ({ id, row_number: index + 2, status: ['valid', 'needs_mapping', 'invalid', 'duplicate'][index], source: { first_name: 'Synthetic', last_name: ['New', 'Mapped', 'Invalid', 'Duplicate'][index], ...(index === 2 ? { birthdate: 'ambiguous' } : {}) }, data: { first_name: 'Synthetic', last_name: ['New', 'Mapped', 'Invalid', 'Duplicate'][index], gender: 'unspecified' }, ministry_names: index === 1 ? ['Unknown Group with a long name'] : [], ministry_ids: [], unknown_ministries: index === 1 ? ['Unknown Group with a long name'] : [], errors: index === 2 ? ['Birthdate must use YYYY-MM-DD or a genuine Excel date cell.'] : index === 3 ? ['A possible existing student requires Owner review and was not selected.'] : [], outcome: null }))
const preview = { id: batch, state: 'previewed', expires_at: '2099-01-01T00:00:00Z', counts: { valid: 1, invalid: 1, duplicate: 1, needs_mapping: 1 }, rows }

async function fixture(context: BrowserContext) {
  let state = 'previewed', uncertain = false, statusFails = false, previews = 0
  const commits: Record<string, unknown>[] = []
  await mockCsrf(context); await mockOwner(context)
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/health') return json(route, { status: 'ok' })
    expect(route.request().headers()['x-church-id']).toBe(churchId)
    if (path === '/api/me') return json(route, { id: 11, email_verified: true, memberships: [{ church_id: churchId, role: 'owner', status: 'active' }], active_session: { mfa_confirmed: true }, assignments: { ministry_ids: [] } })
    if (path === '/api/ministries') return json(route, { data: [{ id: ministryId, name: 'Authorized primary ministry with a long name', status: 'active', version: 1 }] })
    if (path === '/api/imports/students/preview') { previews++; return json(route, preview) }
    if (path === `/api/imports/${batch}/commit`) {
      commits.push(route.request().postDataJSON() as Record<string, unknown>)
      if (uncertain) return route.abort('failed')
      state = 'completed'
      return json(route, { id: batch, state, counts: { committed: (commits.at(-1)!.row_ids as string[]).length, excluded: 3 - (commits.at(-1)!.row_ids as string[]).length, duplicate: 1 } })
    }
    if (path === `/api/imports/${batch}`) {
      if (statusFails) return json(route, { message: 'Private server detail' }, 503)
      const selected = commits.at(-1)?.row_ids as string[] | undefined
      return json(route, { ...preview, state, rows: rows.map(row => ({ ...row, outcome: state === 'completed' ? selected?.includes(row.id) ? 'committed' : row.status === 'duplicate' ? 'duplicate' : 'excluded' : null })) })
    }
    if (path === '/api/students') return json(route, { data: [] })
    throw Error(`Unexpected import fixture request: ${path}`)
  })
  return { commits, previewCount: () => previews, uncertain: (value: boolean, unavailable: boolean) => { uncertain = value; statusFails = unavailable }, complete: () => { state = 'completed'; statusFails = false }, expire: () => { state = 'expired'; statusFails = false } }
}

async function upload(page: Page) {
  await page.goto(`/account/imports?church=${churchId}`)
  await page.getByLabel('Student spreadsheet').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from('first_name,last_name\nSynthetic,New\n') })
  await page.getByRole('button', { name: 'Preview import' }).click()
  await expect(page.getByRole('heading', { name: 'Review and map', exact: true })).toBeFocused()
}
async function confirm(page: Page, count = 1) {
  await page.getByRole('button', { name: 'Review selected' }).click()
  await expect(page.getByRole('heading', { name: 'Confirm selected', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: `Import ${count} students` })).toBeDisabled()
  await page.getByLabel(/I understand that this creates new student records/).check()
}

async function deviceSnapshot(page: Page) {
  const databases = await page.evaluate(() => indexedDB.databases())
  return { databases, records: databases.some(item => item.name === 'ministry-sprout-offline') ? await deviceRecords(page) : null }
}

test('four-stage import is accessible, responsive, deliberate and preserves correction CSV and safe Students navigation', async ({ page, context }) => {
  const proof = await fixture(context); await upload(page)
  const originalDevice = await deviceSnapshot(page)
  await expect(page.getByRole('navigation', { name: 'Import stages' }).locator('[aria-current="step"]')).toContainText('Review and map')
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.getByText('Inspect row 4', { exact: true }).click()
    await expect(page.getByText('Birthdate must use YYYY-MM-DD or a genuine Excel date cell.', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const caption = await page.locator('.wizard-table caption').boundingBox(), table = await page.locator('.wizard-table').boundingBox()
    expect(caption!.width).toBeGreaterThan(table!.width * .8)
    const choice = await page.locator('.wizard-row-choice').first().boundingBox()
    expect(choice!.width).toBeGreaterThanOrEqual(44); expect(choice!.height).toBeGreaterThanOrEqual(44)
    await expectNoSeriousAccessibilityIssues(page)
    await page.screenshot({ path: test.info().outputPath(`import-review-${width}.png`), fullPage: true })
    await page.getByText('Inspect row 4', { exact: true }).click()
  }
  await page.setViewportSize({ width: 320, height: 1000 })
  const enlarged = await page.addStyleTag({ content: ':root{font-size:200%}' })
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const enlargedCaption = await page.locator('.wizard-table caption').boundingBox(), enlargedTable = await page.locator('.wizard-table').boundingBox()
  expect(enlargedCaption!.width).toBeGreaterThan(enlargedTable!.width * .8)
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab')
    await expect.poll(() => page.evaluate(() => {
      const target = document.activeElement
      if (!(target instanceof HTMLElement) || !target.closest('.import-wizard')) return { visible: true }
      const rect = target.getBoundingClientRect(), nav = document.querySelector('.phone-navigation')?.getBoundingClientRect(), bottom = nav?.height ? nav.top : innerHeight
      return { visible: rect.top >= 0 && rect.bottom <= bottom, target: target.getAttribute('aria-label') ?? target.textContent, top: rect.top, bottom: rect.bottom, navigationTop: bottom }
    }), { message: 'Keyboard focus must settle fully above the phone navigation.' }).toMatchObject({ visible: true }).catch(async failure => {
      await test.info().attach('keyboard-focus-geometry', { contentType: 'application/json', body: JSON.stringify(await page.evaluate(() => {
        const target = document.activeElement, rect = target?.getBoundingClientRect(), nav = document.querySelector('.phone-navigation')?.getBoundingClientRect()
        return { tag: target?.tagName, role: target?.getAttribute('role'), top: rect?.top, bottom: rect?.bottom, navigationTop: nav?.top, scrollY }
      })) })
      throw failure
    })
  }
  await expectNoSeriousAccessibilityIssues(page)
  await page.screenshot({ path: test.info().outputPath('import-review-200-percent.png'), fullPage: true })
  await enlarged.evaluate(element => element.remove()); await page.emulateMedia({ forcedColors: 'none' })
  await page.getByLabel('Map Unknown Group with a long name').selectOption(ministryId)
  await page.getByLabel('Approve row 3').check()
  await expect(page.getByText('2 eligible', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Approve row 4')).toBeDisabled(); await expect(page.getByLabel('Approve row 5')).toBeDisabled()
  await confirm(page, 2); expect(proof.commits).toHaveLength(0)
  await page.getByRole('button', { name: 'Back to review' }).click()
  await page.getByLabel('Approve row 2').uncheck(); await page.getByLabel('Approve row 3').uncheck()
  await expect(page.getByRole('button', { name: 'Review selected' })).toBeDisabled()
  await page.getByLabel('Approve row 2').check(); await page.getByLabel('Approve row 3').check()
  await confirm(page, 2); await expectNoSeriousAccessibilityIssues(page)
  await page.screenshot({ path: test.info().outputPath('import-confirm-selected.png'), fullPage: true })
  await page.getByRole('button', { name: 'Import 2 students' }).click()
  await expect(page.getByText('2 students imported.', { exact: true })).toBeVisible()
  await expect(page.getByText('2 rows skipped.', { exact: true })).toBeVisible()
  expect(proof.commits).toHaveLength(1); expect(proof.commits[0]).toMatchObject({ row_ids: [ids[0], ids[1]], ministry_mappings: { 'Unknown Group with a long name': ministryId } })
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download corrections CSV' }).click()
  const downloadPath = await (await downloaded).path()
  expect(downloadPath).not.toBeNull()
  const csv = await readFile(downloadPath!, 'utf8')
  expect(csv).not.toContain('Synthetic,New'); expect(csv).not.toContain('Synthetic,Mapped'); expect(csv).toContain('Synthetic,Invalid'); expect(csv).toContain('Synthetic,Duplicate')
  expect(await deviceSnapshot(page)).toEqual(originalDevice)
  await expectNoSeriousAccessibilityIssues(page); await page.screenshot({ path: test.info().outputPath('import-authoritative-results.png'), fullPage: true })
  await page.getByRole('link', { name: 'Back to students', exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/account/students\\?church=${churchId}`))
})

test('uncertain submission blocks replacement, survives reload and deliberately retries only the same batch and key', async ({ page, context }) => {
  const proof = await fixture(context); await upload(page); await confirm(page)
  proof.uncertain(true, true)
  await page.getByRole('button', { name: 'Import 1 students' }).evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click() })
  await expect(page.getByRole('alert')).toContainText('Import result not confirmed')
  expect(proof.commits).toHaveLength(1); await expect(page.getByLabel('Student spreadsheet')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Retry same selected rows' })).toHaveCount(0)
  const stored = await page.evaluate(() => Object.values(sessionStorage).join(''))
  expect(stored).toContain(batch); expect(stored).not.toContain('Synthetic'); expect(stored).not.toContain('Unknown Group')
  await page.reload(); await expect(page.getByRole('alert')).toContainText('Import result not confirmed')
  proof.uncertain(false, false); await page.getByRole('button', { name: 'Check same batch' }).click(); await page.getByRole('button', { name: 'Retry same selected rows' }).click()
  await expect(page.getByLabel(/I understand that this creates new student records/)).not.toBeChecked()
  await page.getByLabel(/I understand that this creates new student records/).check(); await page.getByRole('button', { name: 'Import 1 students' }).click()
  await expect(page.getByText('1 students imported.', { exact: true })).toBeVisible()
  expect(proof.commits).toHaveLength(2); expect(proof.commits[1]).toEqual(proof.commits[0]); expect(proof.previewCount()).toBe(1)
  await page.reload(); await expect(page.getByText('1 students imported.', { exact: true })).toBeVisible(); expect(proof.commits).toHaveLength(2)
  await expectNoSeriousAccessibilityIssues(page)
})

test('lost successful response reconciles without replay', async ({ page, context }) => {
  const proof = await fixture(context); await upload(page); await confirm(page)
  proof.uncertain(true, false); proof.complete()
  await page.getByRole('button', { name: 'Import 1 students' }).click()
  await expect(page.getByText('1 students imported.', { exact: true })).toBeVisible()
  expect(proof.commits).toHaveLength(1); await expect(page.getByRole('button', { name: 'Retry same selected rows' })).toHaveCount(0)
})

test('expired batches cannot be submitted again or create a replacement automatically', async ({ page, context }) => {
  const proof = await fixture(context); await upload(page); await confirm(page)
  proof.uncertain(true, false)
  proof.expire(); await page.getByRole('button', { name: 'Import 1 students' }).click()
  await expect(page.getByText('This batch expired. No retry is available for this batch.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry same selected rows' })).toHaveCount(0); expect(proof.commits).toHaveLength(1); expect(proof.previewCount()).toBe(1)
})
