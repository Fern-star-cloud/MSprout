import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createOfflineDatabase, type OfflineDatabase } from '../offline/db'
import { createProfileKeyMaterial, unwrapDataKey, encryptPayload, decryptPayload } from '../offline/crypto'
import type { ProfileRecord } from '../offline/schema'
import type { AttendanceDraft, LocalAttendanceEvent } from '../features/attendance/domain'
import { SyncClient, type SyncProfileAccess } from './sync-client'
import { SyncDownloadError } from './pull-validation'
import { ids, testNow, validPage } from './__tests__/pull-fixtures'

describe('real encrypted synchronization-page preservation', () => {
  let db: OfflineDatabase, key: CryptoKey, access: SyncProfileAccess, event: LocalAttendanceEvent
  const now = () => testNow
  const draft: AttendanceDraft = { id: ids.session, profileId: ids.profile, churchId: ids.church,
    ministryId: ids.ministry, ministryName: 'Synthetic ministry', attendanceDate: '2026-10-16',
    status: 'draft', version: 1, entries: [{ studentId: ids.student, displayName: 'Synthetic student', gender: 'unspecified', state: 'absent' }],
    guests: [], updatedAt: testNow.toISOString() }
  const snapshot = () => db.transaction('r', db.tables, async () => Object.fromEntries(await Promise.all(db.tables.map(async table => [table.name, await table.toArray()]))))
  const storedDraft = async () => decryptPayload<AttendanceDraft>(ids.profile, `attendance-draft:${ids.session}`, key, (await db.attendanceDrafts.get([ids.profile, ids.session]))!.encrypted)
  const addPending = async () => {
    await db.outboxEvents.add({ profileId: ids.profile, id: event.id, encrypted: await encryptPayload(ids.profile, `outbox-event:${event.id}`, key, event), updatedAt: testNow.toISOString() })
  }
  beforeEach(async () => {
    db = createOfflineDatabase(`compat-b2-${crypto.randomUUID()}`)
    const material = await createProfileKeyMaterial(ids.profile, '184629')
    key = await unwrapDataKey(ids.profile, '184629', material)
    const page = validPage()
    const profile: ProfileRecord = { ...material, id: ids.profile, actorId: '11', churchId: ids.church, deviceId: ids.device,
      createdAt: testNow.toISOString(), failedAttempts: 0, retryAfter: null, requiresReauthentication: false,
      leaseExpiresAt: page.lease.expires_at, leaseSignature: 'a'.repeat(64), syncNeedsPull: true }
    await db.profiles.add(profile)
    access = { isUnlocked: () => true, encrypt: (p, purpose, value) => encryptPayload(p, purpose, key, value), decrypt: (p, purpose, value) => decryptPayload(p, purpose, key, value), authorizationRenewed: vi.fn(async () => {}) }
    const authorization = { actor: { id: '11' }, lease: { ...page.lease, signature: profile.leaseSignature } }
    for (const [name, value] of [['authorization', authorization], ['roster', [{ id: ids.student, ministry_ids: [ids.ministry] }]], ['ministries', [{ id: ids.ministry }]]] as const) {
      await db.encryptedBlobs.add({ profileId: ids.profile, key: name, encrypted: await access.encrypt(ids.profile, name, value), updatedAt: testNow.toISOString() })
    }
    await db.attendanceDrafts.add({ profileId: ids.profile, id: ids.session, encrypted: await access.encrypt(ids.profile, `attendance-draft:${ids.session}`, draft), updatedAt: testNow.toISOString() })
    await db.serverCursors.add({ profileId: ids.profile, cursor: '1', updatedAt: testNow.toISOString() })
    await db.conflicts.add({ profileId: ids.profile, id: 'prior-conflict', encrypted: await access.encrypt(ids.profile, 'sync-conflict:prior-conflict', { reason: 'existing-review' }), updatedAt: testNow.toISOString() })
    event = { id: '00000000-0000-4000-8000-000000000099', profileId: ids.profile, entityId: ids.session,
      action: 'attendance.student_marked', baseVersion: 1, occurredAt: testNow.toISOString(), payload: { student_id: ids.student, state: 'absent' } }
  })
  afterEach(async () => { await db.delete() })

  it('refuses a valid change followed by unsupported data atomically, retaining newly pending intent and retrying safely', async () => {
    let refused = true, before: Awaited<ReturnType<typeof snapshot>> | undefined
    const fetcher = vi.fn<typeof fetch>(async () => {
      if (!before) { await addPending(); before = await snapshot() }
      const page = validPage()
      if (refused) page.changes.push({ ...page.changes[0], sequence: '4', entity_id: ids.guest,
        payload: { ...page.changes[0].payload, id: ids.guest, records: [{ ...page.changes[0].payload.records[0], state: 'late' }] } })
      return Response.json(page)
    })
    const client = new SyncClient(db, access, { fetcher, now })
    await expect(client.syncProfile(ids.profile)).rejects.toBeInstanceOf(SyncDownloadError)
    expect(await snapshot()).toEqual(before)
    expect(await storedDraft()).toEqual(draft)
    const pending = await db.outboxEvents.get([ids.profile, event.id])
    expect(await access.decrypt(ids.profile, `outbox-event:${event.id}`, pending!.encrypted)).toEqual(event)
    expect(access.authorizationRenewed).not.toHaveBeenCalled()
    // A supported retry may settle only an explicit result for the original ID.
    refused = false
    fetcher.mockImplementation(async input => String(input).startsWith('/api/sync/push')
      ? Response.json({ results: [{ client_event_id: event.id, status: 'accepted', version: 2 }] })
      : Response.json(validPage()))
    const result = await client.syncProfile(ids.profile)
    expect(result.acknowledged).toBe(1); expect(result.nextCursor).toBe('5')
    expect((await storedDraft()).entries[0].state).toBe('present')
    expect((await db.profiles.get(ids.profile))?.syncNeedsPull).toBe(false)
    expect(await db.conflicts.count()).toBe(1)
  })

  it.each(['crypto', 'storage', 'lock', 'expiry', 'replacement-expiry'])('rolls back page effects on %s failure', async failure => {
    let before: Awaited<ReturnType<typeof snapshot>> | undefined, current = true
    const fetcher = vi.fn(async () => { await addPending(); before = await snapshot(); return Response.json(validPage()) })
    const original = access.encrypt
    let clock = testNow
    access = { ...access, isUnlocked: () => current, captureSyncAuthorization: () => ({ assertUnlocked: () => {}, assertCurrent: async () => { if (failure === 'expiry' && before) throw new Error('Offline authorization expired') } }),
      encrypt: async (p, purpose, value) => {
        if (purpose.startsWith('attendance-draft:')) {
          if (failure === 'crypto') throw new Error('Injected encryption failure')
          if (failure === 'lock') current = false
          if (failure === 'replacement-expiry') clock = new Date('2026-10-31T00:00:00Z')
        }
        return original(p, purpose, value)
      } }
    if (failure === 'storage') db.serverCursors.hook('updating', () => { throw new Error('Injected storage failure') })
    await expect(new SyncClient(db, access, { fetcher, now: () => clock }).syncProfile(ids.profile)).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
    expect(await storedDraft()).toEqual(draft)
    expect(access.authorizationRenewed).not.toHaveBeenCalled()
  })

  it('retains earlier committed pages and verified upload receipts when a later page is refused', async () => {
    await addPending()
    let pulls = 0, afterFirst: Awaited<ReturnType<typeof snapshot>> | undefined
    access.authorizationRenewed = vi.fn(async () => { afterFirst = await snapshot() })
    const fetcher = vi.fn(async input => {
      if (String(input).startsWith('/api/sync/push')) return Response.json({ results: [{ client_event_id: event.id, status: 'accepted', version: 2 }] })
      const page = validPage()
      if (++pulls === 1) page.page.has_more = true
      else { page.changes[0].sequence = '6'; page.changes[0].payload.records[0].state = 'late'; page.page.next_cursor = '7' }
      return Response.json(page)
    })
    await expect(new SyncClient(db, access, { fetcher, now }).syncProfile(ids.profile)).rejects.toBeInstanceOf(SyncDownloadError)
    expect(await snapshot()).toEqual(afterFirst)
    expect(await db.outboxEvents.count()).toBe(0)
    expect((await db.serverCursors.get(ids.profile))?.cursor).toBe('5')
    expect((await storedDraft()).version).toBe(2)
    expect((await db.profiles.get(ids.profile))?.syncNeedsPull).toBe(true)
    expect(access.authorizationRenewed).toHaveBeenCalledTimes(1)
  })

  it('refuses a tombstone plus unsupported record without quarantining or removing pending work', async () => {
    let before: Awaited<ReturnType<typeof snapshot>> | undefined
    const fetcher = vi.fn(async () => {
      await addPending(); before = await snapshot()
      const page = validPage(); page.changes[0].payload.records[0].state = 'late'
      const change = { sequence: '2', entity_type: 'ministry_assignment', entity_id: ids.membership, version: 1,
        action: 'tombstone', ministry_id: ids.ministry, payload: { ministry_id: ids.ministry } }
      return Response.json({ ...page, changes: [change, ...page.changes] })
    })
    await expect(new SyncClient(db, access, { fetcher, now }).syncProfile(ids.profile)).rejects.toBeInstanceOf(SyncDownloadError)
    expect(await snapshot()).toEqual(before)
    expect(await storedDraft()).toEqual(draft)
  })

  it('applies a valid scoped tombstone and retains original encrypted draft/event provenance in quarantine', async () => {
    const fetcher = vi.fn(async () => {
      await addPending()
      return Response.json({ ...validPage(), changes: [{ sequence: '3', entity_type: 'ministry_assignment',
        entity_id: ids.membership, version: 1, action: 'tombstone', ministry_id: ids.ministry, payload: { ministry_id: ids.ministry } }] })
    })
    await new SyncClient(db, access, { fetcher, now }).syncProfile(ids.profile)
    expect(await db.attendanceDrafts.count()).toBe(0); expect(await db.outboxEvents.count()).toBe(0)
    const savedDraft = await db.conflicts.get([ids.profile, `draft-${ids.session}`]), savedEvent = await db.conflicts.get([ids.profile, event.id])
    expect(await access.decrypt(ids.profile, `sync-conflict:draft-${ids.session}`, savedDraft!.encrypted)).toMatchObject({ draft, reason: 'assignment_revoked' })
    expect(await access.decrypt(ids.profile, `sync-conflict:${event.id}`, savedEvent!.encrypted)).toMatchObject({ event, reason: 'assignment_revoked' })
    expect((await db.serverCursors.get(ids.profile))?.cursor).toBe('5')
  })

  it('accepts additional valid server records from guest promotion without changing the original local roster', async () => {
    const page = validPage()
    page.changes[0].payload.records.push({ ...page.changes[0].payload.records[0], id: ids.guest, student_id: ids.membership })
    await new SyncClient(db, access, { fetcher: async () => Response.json(page), now }).syncProfile(ids.profile)
    expect((await storedDraft()).entries).toEqual([{ ...draft.entries[0], state: 'present' }])
    expect((await db.serverCursors.get(ids.profile))?.cursor).toBe('5')
  })
})
