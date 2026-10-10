import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createOfflineDatabase } from '../../offline/db'
import { readSyncStatus, syncHeadline } from './sync-status'

let db: ReturnType<typeof createOfflineDatabase>
beforeEach(() => { db = createOfflineDatabase(`ui07-status-${crypto.randomUUID()}`) })
afterEach(async () => { await db.delete() })
const access = { isUnlocked: () => true, isLeaseValid: async () => true }

it('never infers completion from zero uploads and preserves unknown counts', () => {
  expect(syncHeadline({ pending: 0, quarantined: 0, reviews: 0, downloads: 'incomplete' })).toBe('Downloads incomplete')
  expect(syncHeadline({ pending: null, quarantined: null, reviews: null, downloads: 'complete' })).toBe('Synchronization status unknown')
  expect(syncHeadline({ pending: 0, quarantined: 3, reviews: 0, downloads: 'complete' })).toBe('Transfers complete — review remains')
  expect(syncHeadline({ pending: 2, quarantined: 0, reviews: 0, downloads: 'complete' })).toBe('Saved locally — pending upload')
  expect(syncHeadline({ pending: 0, quarantined: 0, reviews: 0, downloads: 'complete' })).toBe('Synchronization complete')
  expect(syncHeadline({ pending: 0, quarantined: 2, reviews: 0, downloads: 'unknown' })).toBe('Synchronization status unknown')
})

it('reads durable download evidence without writes and isolates profile counts', async () => {
  await db.profiles.put({ id: 'a', syncNeedsPull: true } as never)
  await db.serverCursors.put({ profileId: 'a', cursor: '4', updatedAt: '2026-10-10T00:00:00Z' })
  await db.outboxEvents.put({ profileId: 'other', id: 'event' } as never)
  await db.conflicts.put({ profileId: 'a', id: 'immutable-review' } as never)
  const before = await Promise.all(db.tables.map(table => table.toArray()))
  expect(await readSyncStatus('a', db, access)).toEqual({ pending: 0, quarantined: 1, reviews: 0, downloads: 'incomplete' })
  expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before)
  await db.profiles.update('a', { syncNeedsPull: false })
  expect((await readSyncStatus('a', db, access)).downloads).toBe('complete')
})

it('does not expose counts while locked or expired and rejects a lock during a read', async () => {
  expect(await readSyncStatus('a', db, { ...access, isUnlocked: () => false })).toEqual({ pending: null, quarantined: null, reviews: null, downloads: 'unknown' })
  expect(await readSyncStatus('a', db, { ...access, isLeaseValid: async () => false })).toEqual({ pending: null, quarantined: null, reviews: null, downloads: 'unknown' })
  const isUnlocked = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)
  expect(await readSyncStatus('a', db, { ...access, isUnlocked })).toEqual({ pending: null, quarantined: null, reviews: null, downloads: 'unknown' })
})

it('fails to unknown when storage or receipt evidence cannot be verified', async () => {
  await db.profiles.put({ id: 'a', syncNeedsPull: false } as never)
  expect((await readSyncStatus('a', db, access)).downloads).toBe('unknown')
  const failure = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('storage unavailable'))
  expect(await readSyncStatus('a', db, access)).toEqual({ pending: null, quarantined: null, reviews: null, downloads: 'unknown' })
  failure.mockRestore()
})

it('keeps downloaded needs-review drafts visible even without an outbox or quarantine row', async () => {
  await db.profiles.put({ id: 'a', syncNeedsPull: false } as never)
  await db.serverCursors.put({ profileId: 'a', cursor: '4', updatedAt: '2026-10-10T00:00:00Z' })
  await db.attendanceDrafts.put({ profileId: 'a', id: 'review-draft', encrypted: { ciphertext: '{"status":"needs_review"}' } } as never)
  const store = { ...access, decryptLocalPayload: async <T,>() => ({ status: 'needs_review' }) as T }
  const result = await readSyncStatus('a', db, store)
  expect(syncHeadline(result)).toBe('Transfers complete — review remains')
})

it('does not turn unreadable encrypted review status into a zero count', async () => {
  await db.profiles.put({ id: 'a', syncNeedsPull: false } as never)
  await db.serverCursors.put({ profileId: 'a', cursor: '4', updatedAt: '2026-10-10T00:00:00Z' })
  await db.attendanceDrafts.put({ profileId: 'a', id: 'a', encrypted: {} } as never)
  const store = { ...access, decryptLocalPayload: async <T,>() => ({ status: 'unrecognized' }) as T }
  expect(await readSyncStatus('a', db, store)).toEqual({ pending: null, quarantined: null, reviews: null, downloads: 'unknown' })
})
