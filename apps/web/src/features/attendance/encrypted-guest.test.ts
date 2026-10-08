import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createOfflineDatabase, type OfflineDatabase } from '../../offline/db'
import { LocalProfileStore } from '../../offline/profile-store'
import { AttendanceRepository } from './attendance-repository'

let db: OfflineDatabase
let store: LocalProfileStore
let repository: AttendanceRepository
let profileId: string
let draftId: string
let now: Date

beforeEach(async () => {
  db = createOfflineDatabase(`encrypted-guest-${crypto.randomUUID()}`)
  now = new Date('2026-10-08T10:20:00Z')
  store = new LocalProfileStore(db, { now: () => now })
  const profile = await store.createProfile({ actorId: '11', churchId: '00000000-0000-4000-8000-000000000010', pin: '184629' })
  profileId = profile.id
  await store.unlockProfile(profile.id, '184629')
  await store.saveBootstrap(profile.id, {
    actor: { id: '11' }, ministries: [{ id: 'ministry-a', name: 'Music', version: 1 }], roster: [], server_cursor: '0',
    lease: { actor_id: '11', church_id: profile.churchId!, device_id: profile.deviceId, membership_id: 'membership-a',
      issued_at: now.toISOString(), expires_at: '2026-10-22T10:20:00Z', signature: 'a'.repeat(64) },
  })
  repository = new AttendanceRepository(db, {
    encrypt: (id, purpose, value) => store.encryptLocalPayload(id, purpose, value),
    decrypt: (id, purpose, value) => store.decryptLocalPayload(id, purpose, value),
  })
  draftId = (await repository.createDraft({ profileId, churchId: profile.churchId!, ministryId: 'ministry-a',
    ministryName: 'Music', attendanceDate: '2026-10-08', students: [] })).id
})

afterEach(async () => { vi.restoreAllMocks(); store.dispose(); await db.delete() })

it('initializes an encrypted leased draft with one legitimate pending create event, then persists a guest', async () => {
  expect(await store.isLeaseValid(profileId)).toBe(true)
  expect((await db.profiles.get(profileId))?.requiresReauthentication).toBe(false)
  expect(await repository.countPending(profileId)).toBe(1)
  expect((await repository.listEvents(profileId))[0].action).toBe('attendance.draft_created')
  await repository.addGuest(profileId, draftId, 'MTQA Offline Guest', 'unspecified')
  expect((await repository.findDraft(profileId, 'ministry-a', '2026-10-08'))?.guests).toEqual([
    expect.objectContaining({ displayName: 'MTQA Offline Guest', gender: 'unspecified', state: 'present' }),
  ])
  expect(await repository.countPending(profileId)).toBe(2)
  expect(JSON.stringify(await db.attendanceDrafts.toArray())).not.toContain('MTQA Offline Guest')
  expect(JSON.stringify(await db.outboxEvents.toArray())).not.toContain('MTQA Offline Guest')
})

it('rejects a guest while locked without changing queued work, then saves after unlocking the same profile', async () => {
  const before = await db.attendanceDrafts.toArray()
  store.lockProfile(profileId)
  await expect(repository.addGuest(profileId, draftId, 'MTQA Offline Guest')).rejects.toThrow('locked')
  expect(await db.attendanceDrafts.toArray()).toEqual(before)
  expect(await repository.countPending(profileId)).toBe(1)
  await store.unlockProfile(profileId, '184629')
  await repository.addGuest(profileId, draftId, 'MTQA Offline Guest')
  expect(await repository.countPending(profileId)).toBe(2)
})

it('rejects guest writes after encrypted lease expiry without extending authority or discarding work', async () => {
  const before = await db.attendanceDrafts.toArray()
  now = new Date('2026-10-22T10:20:01Z')
  await expect(repository.addGuest(profileId, draftId, 'MTQA Offline Guest')).rejects.toThrow('expired')
  expect(await db.attendanceDrafts.toArray()).toEqual(before)
  expect(await repository.countPending(profileId)).toBe(1)
})

it('rolls back an encrypted guest draft when outbox storage fails', async () => {
  const before = await db.attendanceDrafts.toArray()
  vi.spyOn(db.outboxEvents, 'add').mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'))
  await expect(repository.addGuest(profileId, draftId, 'MTQA Offline Guest')).rejects.toThrow('Full')
  expect(await db.attendanceDrafts.toArray()).toEqual(before)
  expect(await repository.countPending(profileId)).toBe(1)
})
