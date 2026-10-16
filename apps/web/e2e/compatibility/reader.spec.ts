import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { startCompatibilityServer, loadBuild } from '../../../../scripts/compatibility/server.mjs'
import { deviceRecords, expectNoSeriousAccessibilityIssues } from '../support'

// Synthetic incompatibility responses, real distinct application assets and real
// encrypted browser storage. SWs are blocked only in this isolated reader probe;
// neither installed-PWA transition nor server acceptance is claimed.
for (const build of ['legacy', 'candidate']) for (const width of [320, 390, 768, 1440]) {
  test(`${build} synthetic unsupported-state reader at ${width}px`, async ({ page, context }, info) => {
    const legacyPath = resolve(info.config.rootDir, '../../../../.git/msprout-compat-b1-20261016/frozen-01/manifest.json')
    const server = await startCompatibilityServer({ manifestPath: legacyPath })
    const candidatePath = resolve(process.env.COMPAT_B2_CANDIDATE!)
    const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'))
    expect(candidate.sourceKind).toBe('B2-uncommitted-candidate')
    if (build === 'candidate') server.substitute(candidatePath, candidate.sourceSha)
    const { manifest } = loadBuild(build === 'legacy' ? legacyPath : candidatePath, build === 'legacy' ? '9c30def911bb59ae02ecfd3fa291607f141b8c68' : candidate.sourceSha)
    let refused = true, before: Awaited<ReturnType<typeof deviceRecords>> | undefined, pushes = 0
    const external: string[] = []
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === server.origin) return route.continue()
      external.push(new URL(route.request().url()).origin); return route.abort('blockedbyclient')
    })
    await context.route('**/api/sync-conflicts', route => route.fulfill({ json: { needs_owner_review: false } }))
    await context.route('**/api/sync/push', route => { pushes++; return route.fulfill({ status: 503, json: { code: 'synthetic-no-upload-fixture' } }) })
    await context.route('**/api/sync/pull**', async route => {
      before = await deviceRecords(page)
      const profile = before.profiles[0]
      return route.fulfill({ json: {
        changes: [{ sequence: '3', entity_type: 'attendance_session', entity_id: '00000000-0000-4000-8000-000000000050', version: 2,
          action: 'upsert', ministry_id: '00000000-0000-4000-8000-000000000020',
          payload: { id: '00000000-0000-4000-8000-000000000050', ministry_id: '00000000-0000-4000-8000-000000000020',
            attendance_date: '2026-10-16', status: 'draft', version: 2, guests: [],
            records: [{ id: '00000000-0000-4000-8000-000000000070', student_id: '00000000-0000-4000-8000-000000000031', state: refused ? 'late' : 'present', version: 1 }],
          } }], page: { next_cursor: '5', has_more: false },
        lease: { actor_id: '11', church_id: profile.churchId, device_id: profile.deviceId,
          membership_id: '00000000-0000-4000-8000-000000000040', issued_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 14 * 86400000).toISOString(), signature: 'b'.repeat(64) },
      } })
    })
    try {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(server.origin + '/profiles?church=00000000-0000-4000-8000-000000000010')
      const asset = Object.keys(manifest.assetHashes).find(path => /^assets\/index-.*\.js$/.test(path))!
      const bytes = await (await page.request.get(server.origin + '/' + asset)).body()
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.assetHashes[asset])
      await page.getByRole('link', { name: 'Prepare this device', exact: true }).click()
      await page.getByRole('button', { name: 'Continue to local PIN' }).click()
      await page.getByLabel('Choose a 6–12 digit local PIN').fill('184629')
      await page.getByLabel('Confirm local PIN', { exact: true }).fill('184629')
      await page.getByRole('button', { name: 'Prepare encrypted profile' }).click()
      await expect(page.getByRole('button', { name: 'Open Attendance' })).toBeVisible({ timeout: 30_000 })
      await page.goto(server.origin + '/account/sync')
      await page.getByLabel('Existing local PIN', { exact: true }).fill('184629')
      await page.getByRole('button', { name: 'Unlock existing profile', exact: true }).click()
      await page.getByRole('button', { name: 'Continue synchronization', exact: true }).click()
      if (build === 'candidate') {
        const error = page.getByRole('alert')
        await expect(error).toContainText('Downloading could not be completed safely.')
        await expect(error).toContainText('Saved local work remains protected.')
        expect(await deviceRecords(page)).toEqual(before)
        expect(before!.attendanceDrafts).toHaveLength(0)
        expect(before!.outboxEvents).toHaveLength(0)
        await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Continue synchronization', exact: true })).toBeEnabled()
        await expectNoSeriousAccessibilityIssues(page)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await page.screenshot({ path: info.outputPath('refused-download.png'), fullPage: true })
        await info.attach('preservation', { body: JSON.stringify({ sourceKind: candidate.sourceKind, sourceSnapshot: candidate.sourceSnapshotSha256, before, after: await deviceRecords(page), syntheticFixture: true }), contentType: 'application/json' })
        refused = false
        await page.getByRole('button', { name: 'Continue synchronization', exact: true }).click()
      }
      await expect(page.getByRole('heading', { name: 'Synchronization complete', exact: true })).toBeVisible()
      const after = await deviceRecords(page)
      expect(after.serverCursors).toMatchObject([{ cursor: '5' }])
      expect(after.profiles[0].syncNeedsPull).toBe(false)
      expect(pushes).toBe(0); expect(external).toEqual([])
      await info.attach('reader-outcome', { body: JSON.stringify({ build, sourceSha: manifest.sourceSha, asset, assetSha256: manifest.assetHashes[asset], observed: build === 'legacy' ? 'KNOWN UNSAFE baseline accepts synthetic late without local projection' : 'Refused unsupported page atomically, then supported retry completed', installedUpgrade: 'NOT TESTED', syntheticFixture: true, pushes }), contentType: 'application/json' })
    } finally { await server.stop() }
  })
}
