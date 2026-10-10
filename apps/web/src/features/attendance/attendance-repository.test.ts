import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createOfflineDatabase, type OfflineDatabase } from '../../offline/db'
import type { EncryptedEnvelope } from '../../offline/schema'
import { AttendanceRepository, type AttendanceCrypto } from './attendance-repository'

const codec: AttendanceCrypto = {
  async encrypt(_profileId, _purpose, value) {
    return { algorithm: 'AES-256-GCM', iv: 'test-iv', ciphertext: JSON.stringify(value), schemaVersion: 1 }
  },
  async decrypt<T>(_profileId: string, _purpose: string, envelope: EncryptedEnvelope) {
    return JSON.parse(envelope.ciphertext) as T
  },
}

describe('offline attendance repository', () => {
  let db: OfflineDatabase
  let repository: AttendanceRepository
  let sequence: number

  beforeEach(async () => {
    db = createOfflineDatabase(`attendance-${crypto.randomUUID()}`)
    await db.profiles.add({
      id: 'profile-a', actorId: '11', churchId: '00000000-0000-4000-8000-000000000001', deviceId: 'synthetic', createdAt: '2026-09-28T00:00:00Z',
      failedAttempts: 0, retryAfter: null, leaseExpiresAt: null, leaseSignature: null, requiresReauthentication: true,
      salt: 'synthetic', iterations: 600_000, wrappedDataKey: { algorithm: 'AES-256-GCM', iv: 'test', ciphertext: 'test', schemaVersion: 1 },
    })
    sequence = 0
    repository = new AttendanceRepository(db, codec, {
      now: () => new Date(`2026-09-28T00:00:0${sequence}Z`),
      id: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    })
  })

  afterEach(async () => { await db.delete() })

  async function createDraft() {
    return repository.createDraft({
      profileId: 'profile-a',
      churchId: '00000000-0000-4000-8000-000000000001',
      ministryId: '00000000-0000-4000-8000-000000000002',
      ministryName: 'Primary',
      attendanceDate: '2026-09-28',
      students: [
        { id: '00000000-0000-4000-8000-000000000003', displayName: 'Ana Sprout', gender: 'female' },
        { id: '00000000-0000-4000-8000-000000000004', displayName: 'Ben Sprout', gender: 'male' },
      ],
    })
  }

  it('saves a draft and exactly one deterministic outbox event atomically', async () => {
    const draft = await createDraft()

    expect(draft.entries.map(entry => entry.state)).toEqual(['unmarked', 'unmarked'])
    expect(await db.attendanceDrafts.where('profileId').equals('profile-a').count()).toBe(1)
    expect(await db.outboxEvents.where('profileId').equals('profile-a').count()).toBe(1)
    expect((await repository.listEvents('profile-a'))[0]).toMatchObject({
      action: 'attendance.draft_created',
      entityId: draft.id,
      baseVersion: 0,
    })
  })

  it('reuses the same session draft when creation is requested concurrently', async () => {
    const [first, second] = await Promise.all([createDraft(), createDraft()])

    expect(second.id).toBe(first.id)
    expect(await db.attendanceDrafts.where('profileId').equals('profile-a').count()).toBe(1)
    expect(await db.outboxEvents.where('profileId').equals('profile-a').count()).toBe(1)
  })

  it('rejects impossible calendar dates before writing local state', async () => {
    await expect(repository.createDraft({
      profileId: 'profile-a',
      churchId: '00000000-0000-4000-8000-000000000001',
      ministryId: '00000000-0000-4000-8000-000000000002',
      ministryName: 'Primary',
      attendanceDate: '2026-02-31',
      students: [],
    })).rejects.toThrow('invalid')

    expect(await db.attendanceDrafts.count()).toBe(0)
    expect(await db.outboxEvents.count()).toBe(0)
  })

  it('updates marks and appends one minimal event in the same transaction', async () => {
    const draft = await createDraft()
    const marked = await repository.markStudent('profile-a', draft.id, draft.entries[0].studentId, 'present')
    const bulk = await repository.bulkMark('profile-a', draft.id, 'absent', 'unmarked')

    expect(marked.entries[0].state).toBe('present')
    expect(bulk.entries.map(entry => entry.state)).toEqual(['present', 'absent'])
    expect(await repository.listEvents('profile-a')).toHaveLength(3)
    expect(JSON.stringify(await repository.listEvents('profile-a'))).not.toContain('Ana Sprout')
  })

  it('blocks finalization until every regular roster entry is marked', async () => {
    const draft = await createDraft()
    await expect(repository.finalizeDraft('profile-a', draft.id)).rejects.toThrow('unmarked')
    await repository.bulkMark('profile-a', draft.id, 'present')

    const finalized = await repository.finalizeDraft('profile-a', draft.id)

    expect(finalized.status).toBe('finalized_pending')
    expect((await repository.listEvents('profile-a')).at(-1)?.action).toBe('attendance.finalized')
  })

  it('adds a present temporary guest with only the approved minimal sync payload', async () => {
    const draft = await createDraft()

    const withGuest = await repository.addGuest('profile-a', draft.id, '  Guest   Child  ', 'female')
    const event = (await repository.listEvents('profile-a')).at(-1)

    expect(withGuest.guests).toEqual([{
      id: event?.id,
      displayName: 'Guest Child',
      gender: 'female',
      state: 'present',
      status: 'pending',
    }])
    expect(event).toMatchObject({
      action: 'attendance.guest_added',
      entityId: draft.id,
      payload: { display_name: 'Guest Child', gender: 'female' },
    })
    expect(Object.keys(event?.payload ?? {}).sort()).toEqual(['display_name', 'gender'])
  })

  it('rolls back the draft write when the matching outbox event cannot be stored', async () => {
    await db.outboxEvents.add({
      profileId: 'profile-a',
      id: '00000000-0000-4000-8000-000000000001',
      encrypted: await codec.encrypt('profile-a', 'outbox-event:00000000-0000-4000-8000-000000000001', {}),
      updatedAt: '2026-09-28T00:00:00Z',
    })

    await expect(createDraft()).rejects.toThrow()
    expect(await db.attendanceDrafts.where('profileId').equals('profile-a').count()).toBe(0)
  })

  it('repeated Start preserves marks and guests and never recreates an accepted creation event', async () => {
    const first = await createDraft()
    await repository.markStudent('profile-a', first.id, first.entries[0].studentId, 'absent')
    const saved = await repository.addGuest('profile-a', first.id, 'Synthetic persisted guest')
    const creation = (await repository.listEvents('profile-a')).find(event => event.action === 'attendance.draft_created')!
    // Model the existing synchronizer removing an acknowledged outbox event.
    await db.outboxEvents.delete(['profile-a', creation.id])
    const before = await db.outboxEvents.toArray()
    expect(await createDraft()).toEqual(saved)
    expect(await db.outboxEvents.toArray()).toEqual(before)
    db.close()
    await db.open()
    expect(await repository.findDraft('profile-a', saved.ministryId, saved.attendanceDate)).toEqual(saved)
  })

  it('same session identity remains profile-scoped on a shared device', async () => {
    const original = (await db.profiles.get('profile-a'))!
    await db.profiles.add({ ...original, id: 'profile-b', actorId: '22', deviceId: 'synthetic-b' })
    const first = await createDraft()
    const other = await repository.createDraft({ profileId: 'profile-b', churchId: first.churchId, ministryId: first.ministryId,
      ministryName: 'Primary', attendanceDate: first.attendanceDate, students: [] })
    expect(other.id).toBe(first.id)
    expect(other.entries).toEqual([])
    await repository.addGuest('profile-b', other.id, 'Synthetic profile B guest')
    expect(await repository.findDraft('profile-a', first.ministryId, first.attendanceDate)).toEqual(first)
    expect(await repository.countPending('profile-a')).toBe(1)
    expect(await repository.countPending('profile-b')).toBe(2)
    await expect(repository.markStudent('profile-b', first.id, first.entries[0].studentId, 'present')).rejects.toThrow('not part')
  })

  it('a guest transaction rolls back completely when its outbox write fails', async () => {
    const draft = await createDraft()
    const before = await db.attendanceDrafts.toArray()
    await db.outboxEvents.add({ profileId: 'profile-a', id: '00000000-0000-4000-8000-000000000002',
      encrypted: await codec.encrypt('profile-a', 'synthetic-collision', {}), updatedAt: draft.updatedAt })
    const events = await db.outboxEvents.toArray()
    await expect(repository.addGuest('profile-a', draft.id, 'Synthetic rejected guest')).rejects.toThrow()
    expect(await db.attendanceDrafts.toArray()).toEqual(before)
    expect(await db.outboxEvents.toArray()).toEqual(events)
  })

  it('concurrent mutations reject the stale writer without losing the winner or adding its event', async () => {
    const draft = await createDraft()
    let reads = 0, release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const concurrent = new AttendanceRepository(db, { ...codec, async decrypt<T>(profile: string, purpose: string, envelope: EncryptedEnvelope) {
      const value = await codec.decrypt<T>(profile, purpose, envelope)
      if (purpose.startsWith('attendance-draft:')) { if (++reads === 2) release(); await barrier }
      return value
    } }, { id: () => crypto.randomUUID() })
    const results = await Promise.allSettled([
      concurrent.markStudent('profile-a', draft.id, draft.entries[0].studentId, 'present'),
      concurrent.addGuest('profile-a', draft.id, 'Synthetic concurrent guest'),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult
    expect(String(failure.reason)).toContain('Reload')
    const winner = results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<typeof draft>
    expect(await repository.findDraft('profile-a', draft.ministryId, draft.attendanceDate)).toEqual(winner.value)
    expect(await repository.listEvents('profile-a')).toHaveLength(2)
  })

  it('finalized sessions reject every mutation and preserve encrypted rows and events', async () => {
    const draft = await createDraft()
    await repository.bulkMark('profile-a', draft.id, 'absent')
    await repository.finalizeDraft('profile-a', draft.id)
    const before = [await db.attendanceDrafts.toArray(), await db.outboxEvents.toArray()]
    for (const operation of [() => repository.markStudent('profile-a', draft.id, draft.entries[0].studentId, 'present'),
      () => repository.bulkMark('profile-a', draft.id, 'present'), () => repository.addGuest('profile-a', draft.id, 'Synthetic late guest'),
      () => repository.finalizeDraft('profile-a', draft.id)]) await expect(operation()).rejects.toThrow('no longer editable')
    expect([await db.attendanceDrafts.toArray(), await db.outboxEvents.toArray()]).toEqual(before)
  })
})
