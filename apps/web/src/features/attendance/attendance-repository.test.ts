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
})
