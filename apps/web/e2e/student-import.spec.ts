import { expect, test } from '@playwright/test'
import { churchId, expectNoSeriousAccessibilityIssues, json, ministryId, mockCsrf, mockOwner } from './support'

test.use({ serviceWorkers: 'block' })

test('Owner preview excludes duplicates and commits only explicitly approved valid rows once', async ({ page, context }) => {
  await mockCsrf(context)
  const batchId = '00000000-0000-4000-8000-000000000090'
  const validRow = '00000000-0000-4000-8000-000000000091'
  const duplicateRow = '00000000-0000-4000-8000-000000000092'
  let commits = 0
  let commitKey = ''
  await mockOwner(context)
  await context.route('**/api/ministries', route => json(route, { data: [{ id: ministryId, name: 'Primary', status: 'active', version: 1 }] }))
  await context.route('**/api/imports/students/preview', route => json(route, {
    id: batchId, state: 'previewed', expires_at: '2099-10-01T00:00:00Z',
    counts: { valid: 1, invalid: 0, duplicate: 1, needs_mapping: 0 },
    rows: [
      { id: validRow, row_number: 2, status: 'valid', source: { first_name: 'Pilot', last_name: 'New' }, data: { first_name: 'Pilot', last_name: 'New', gender: 'unspecified' }, ministry_names: ['Primary'], ministry_ids: [ministryId], unknown_ministries: [], errors: [], outcome: null },
      { id: duplicateRow, row_number: 3, status: 'duplicate', source: { first_name: 'Existing', last_name: 'Student' }, data: { first_name: 'Existing', last_name: 'Student', gender: 'unspecified' }, ministry_names: ['Primary'], ministry_ids: [ministryId], unknown_ministries: [], errors: ['Possible existing student.'], outcome: null },
    ],
  }))
  await context.route(`**/api/imports/${batchId}/commit`, async route => {
    const body = route.request().postDataJSON() as { commit_key: string; row_ids: string[] }
    commitKey ||= body.commit_key
    expect(body.commit_key).toBe(commitKey)
    expect(body.row_ids).toEqual([validRow])
    commits += 1
    await json(route, { id: batchId, state: 'completed', counts: { committed: 1, excluded: 1, duplicate: 1 } })
  })

  await page.goto(`/account/imports?church=${churchId}`)
  await page.getByLabel('Student spreadsheet').setInputFiles({
    name: 'pilot-students.csv', mimeType: 'text/csv', buffer: Buffer.from('first_name,last_name\nPilot,New\nExisting,Student\n'),
  })
  await page.getByRole('button', { name: 'Preview import' }).click()
  await expect(page.getByText('1 valid')).toBeVisible()
  await expect(page.getByText('1 duplicate')).toBeVisible()
  await expect(page.getByLabel('Approve row 3')).toBeDisabled()
  await page.getByRole('button', { name: 'Commit 1 students' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'students imported' })).toHaveText('1 students imported.')
  await expect(page.getByRole('button', { name: 'Commit 1 students' })).toBeDisabled()
  expect(commits).toBe(1)
  await expectNoSeriousAccessibilityIssues(page)
})
