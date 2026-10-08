import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOfflineDatabase, type OfflineDatabase } from '../offline/db'
import type { EncryptedEnvelope, OfflineLease, ProfileRecord } from '../offline/schema'
import type { AttendanceDraft, LocalAttendanceEvent } from '../features/attendance/domain'
import { SyncClient, type SyncProfileAccess } from './sync-client'

const profileId = 'profile-a'
const churchId = '00000000-0000-4000-8000-000000000010'
const deviceId = '00000000-0000-4000-8000-000000000020'
const actorId = '11'

const codec: SyncProfileAccess = {
  isUnlocked: () => true,
  async encrypt(_profile, _purpose, value) {
    return { algorithm: 'AES-256-GCM', iv: 'test-iv', ciphertext: JSON.stringify(value), schemaVersion: 1 }
  },
  async decrypt<T>(_profile: string, _purpose: string, envelope: EncryptedEnvelope) {
    return JSON.parse(envelope.ciphertext) as T
  },
}

function lease(): OfflineLease {
  return {
    actor_id: actorId,
    church_id: churchId,
    membership_id: '00000000-0000-4000-8000-000000000030',
    device_id: deviceId,
    issued_at: '2026-09-29T00:00:00Z',
    expires_at: '2026-10-13T00:00:00Z',
    signature: 'a'.repeat(64),
  }
}

describe('profile synchronization client', () => {
  let db: OfflineDatabase
  let eventIds: string[]

  beforeEach(async () => {
    db = createOfflineDatabase(`sync-${crypto.randomUUID()}`)
    const profile: ProfileRecord = {
      id: profileId, actorId, churchId, deviceId, createdAt: '2026-09-29T00:00:00Z',
      failedAttempts: 0, retryAfter: null, leaseExpiresAt: '2026-10-13T00:00:00Z',
      leaseSignature: 'a'.repeat(64), requiresReauthentication: false, salt: 'salt', iterations: 600_000,
      wrappedDataKey: { algorithm: 'AES-256-GCM', iv: 'iv', ciphertext: 'wrapped', schemaVersion: 1 },
    }
    await db.profiles.add(profile)
    await db.serverCursors.add({ profileId, cursor: '0', updatedAt: '2026-09-29T00:00:00Z' })
    eventIds = [
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000102',
    ]
    for (const [index, id] of eventIds.entries()) {
      const event: LocalAttendanceEvent = {
        id, profileId, entityId: '00000000-0000-4000-8000-000000000200',
        action: index === 0 ? 'attendance.draft_created' : 'attendance.student_marked',
        baseVersion: index, occurredAt: `2026-09-29T00:00:0${index}Z`, payload: {},
      }
      await db.outboxEvents.add({
        profileId, id, encrypted: await codec.encrypt(profileId, `outbox-event:${id}`, event), updatedAt: event.occurredAt,
      })
    }
  })

  afterEach(async () => { await db.delete() })

  it('pushes in stable order, acknowledges safe results, and pulls until the cursor is current', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })
      if (url === '/api/sync/push') {
        const body = JSON.parse(String(init?.body))
        expect(body.events.map((event: { client_event_id: string }) => event.client_event_id)).toEqual(eventIds)
        return Response.json({
          results: [
            { client_event_id: eventIds[0], status: 'accepted', record_id: body.events[0].entity_id, version: 1 },
            { client_event_id: eventIds[1], status: 'duplicate', original_status: 'accepted', record_id: body.events[1].entity_id, version: 2 },
          ],
        })
      }
      const cursor = new URL(url, 'https://example.test').searchParams.get('cursor')
      if (cursor === '0') return Response.json({ changes: [], page: { next_cursor: '4', has_more: true }, lease: lease() })
      return Response.json({ changes: [], page: { next_cursor: '7', has_more: false }, lease: lease() })
    })
    const renewedCursors: string[] = []
    const access: SyncProfileAccess = { ...codec, authorizationRenewed: async currentProfileId => {
      // Renewal notification follows the committed encrypted lease and cursor, never a speculative response.
      expect((await db.profiles.get(currentProfileId))?.leaseExpiresAt).toBe(lease().expires_at)
      expect(await db.encryptedBlobs.get([currentProfileId, 'authorization'])).toBeDefined()
      renewedCursors.push((await db.serverCursors.get(currentProfileId))!.cursor)
    } }
    const client = new SyncClient(db, access, { fetcher, uuid: () => '00000000-0000-4000-8000-000000000999' })

    const summary = await client.syncProfile(profileId)

    expect(summary).toEqual({ pushed: 2, acknowledged: 2, conflicts: 0, rejected: 0, pulled: 0, nextCursor: '7' })
    expect(await db.outboxEvents.where('profileId').equals(profileId).count()).toBe(0)
    expect((await db.serverCursors.get(profileId))?.cursor).toBe('7')
    expect(requests.filter(request => request.url.startsWith('/api/sync/pull'))).toHaveLength(2)
    expect(renewedCursors).toEqual(['4', '7'])
  })

  it('applies the encrypted temporary guest lifecycle from the attendance change feed', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000200'
    const guestId = '00000000-0000-4000-8000-000000000500'
    const draft: AttendanceDraft = {
      id: sessionId, profileId, churchId, ministryId: '00000000-0000-4000-8000-000000000300',
      ministryName: 'Primary', attendanceDate: '2026-09-29', status: 'draft', version: 2,
      entries: [], guests: [{ id: guestId, displayName: 'Guest Child', gender: 'female', state: 'present', status: 'pending' }],
      updatedAt: '2026-09-29T00:00:00Z',
    }
    await db.attendanceDrafts.add({
      profileId, id: sessionId, encrypted: await codec.encrypt(profileId, `attendance-draft:${sessionId}`, draft),
      updatedAt: draft.updatedAt,
    })
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/sync/push') {
        const body = JSON.parse(String(init?.body))
        return Response.json({ results: body.events.map((event: { client_event_id: string }) => ({
          client_event_id: event.client_event_id, status: 'accepted', record_id: sessionId, version: 2,
        })) })
      }
      return Response.json({
        changes: [{
          sequence: '1', entity_type: 'attendance_session', entity_id: sessionId, version: 3,
          action: 'upsert', ministry_id: draft.ministryId,
          payload: { status: 'draft', records: [], guests: [{
            id: guestId, display_name: 'Guest Child', gender: 'female', state: 'present', status: 'linked',
            resolved_student_id: '00000000-0000-4000-8000-000000000600', merged_into_guest_id: null,
          }] },
        }],
        page: { next_cursor: '1', has_more: false }, lease: lease(),
      })
    })

    await new SyncClient(db, codec, { fetcher }).syncProfile(profileId)

    const stored = await db.attendanceDrafts.get([profileId, sessionId])
    const current = await codec.decrypt<AttendanceDraft>(profileId, `attendance-draft:${sessionId}`, stored!.encrypted)
    expect(current.guests).toEqual([{ id: guestId, displayName: 'Guest Child', gender: 'female', state: 'present', status: 'linked' }])
    expect(current.version).toBe(3)
  })

  it('quarantines rejected and conflicting events with their safe reason', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/sync/push') return Response.json({ results: [
        { client_event_id: eventIds[0], status: 'conflict', reason: 'version_conflict', version: 3 },
        { client_event_id: eventIds[1], status: 'rejected', reason: 'assignment_revoked' },
      ] })
      return Response.json({ changes: [], page: { next_cursor: '0', has_more: false }, lease: lease() })
    })
    const client = new SyncClient(db, codec, { fetcher })

    const summary = await client.syncProfile(profileId)

    expect(summary.conflicts).toBe(1)
    expect(summary.rejected).toBe(1)
    expect(await db.outboxEvents.where('profileId').equals(profileId).count()).toBe(0)
    expect(await db.conflicts.where('profileId').equals(profileId).count()).toBe(2)
    const stored = await db.conflicts.where('profileId').equals(profileId).first()
    expect(await codec.decrypt<{ reason: string }>(profileId, `sync-conflict:${stored?.id}`, stored!.encrypted)).toHaveProperty('reason')
  })

  it('retries transient failures with bounded backoff without changing the local event order', async () => {
    const sleep = vi.fn(async () => undefined)
    let attempts = 0
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/sync/push') {
        attempts += 1
        if (attempts < 3) throw new TypeError('offline')
        const body = JSON.parse(String(init?.body))
        return Response.json({ results: body.events.map((event: { client_event_id: string; entity_id: string }) => ({
          client_event_id: event.client_event_id, status: 'accepted', record_id: event.entity_id, version: 1,
        })) })
      }
      return Response.json({ changes: [], page: { next_cursor: '0', has_more: false }, lease: lease() })
    })
    const client = new SyncClient(db, codec, { fetcher, sleep, random: () => 0 })

    await client.syncProfile(profileId)

    expect(attempts).toBe(3)
    expect(sleep).toHaveBeenNthCalledWith(1, 250)
    expect(sleep).toHaveBeenNthCalledWith(2, 500)
    expect(await db.outboxEvents.count()).toBe(0)
  })

  it('applies multiple assignment tombstones cumulatively with the cursor transaction', async () => {
    const revoked = [
      '00000000-0000-4000-8000-000000000301',
      '00000000-0000-4000-8000-000000000302',
    ]
    const retained = '00000000-0000-4000-8000-000000000303'
    await db.encryptedBlobs.bulkPut([
      {
        profileId, key: 'ministries', updatedAt: '2026-09-29T00:00:00Z',
        encrypted: await codec.encrypt(profileId, 'ministries', [...revoked, retained].map(id => ({ id }))),
      },
      {
        profileId, key: 'roster', updatedAt: '2026-09-29T00:00:00Z',
        encrypted: await codec.encrypt(profileId, 'roster', [{ id: 'student-a', ministry_ids: [...revoked, retained] }]),
      },
    ])
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/sync/push') {
        const body = JSON.parse(String(init?.body))
        return Response.json({ results: body.events.map((event: { client_event_id: string; entity_id: string }) => ({
          client_event_id: event.client_event_id, status: 'accepted', record_id: event.entity_id, version: 1,
        })) })
      }
      return Response.json({
        changes: revoked.map((ministry, index) => ({
          sequence: String(index + 1), entity_type: 'ministry_assignment',
          entity_id: `00000000-0000-4000-8000-00000000040${index}`, version: 1,
          action: 'tombstone', ministry_id: ministry, payload: { ministry_id: ministry },
        })),
        page: { next_cursor: '2', has_more: false }, lease: lease(),
      })
    })

    await new SyncClient(db, codec, { fetcher }).syncProfile(profileId)

    const ministries = await db.encryptedBlobs.get([profileId, 'ministries'])
    const roster = await db.encryptedBlobs.get([profileId, 'roster'])
    expect(await codec.decrypt<Array<{ id: string }>>(profileId, 'ministries', ministries!.encrypted)).toEqual([{ id: retained }])
    expect(await codec.decrypt<Array<{ ministry_ids: string[] }>>(profileId, 'roster', roster!.encrypted)).toEqual([{ id: 'student-a', ministry_ids: [retained] }])
    expect((await db.serverCursors.get(profileId))?.cursor).toBe('2')
  })

  it('refuses to synchronize a locked or reauthentication-required profile', async () => {
    const locked = new SyncClient(db, { ...codec, isUnlocked: () => false })
    await expect(locked.syncProfile(profileId)).rejects.toThrow('unlocked')

    await db.profiles.update(profileId, { requiresReauthentication: true })
    const client = new SyncClient(db, codec)
    await expect(client.syncProfile(profileId)).rejects.toThrow('Authenticate')
  })

  it('purges cached roster projections but preserves unsynced work after authorization fails online', async () => {
    await db.encryptedBlobs.bulkPut([
      { profileId, key: 'roster', encrypted: await codec.encrypt(profileId, 'roster', [{ id: 'student-a' }]), updatedAt: '2026-09-29T00:00:00Z' },
      { profileId, key: 'ministries', encrypted: await codec.encrypt(profileId, 'ministries', [{ id: 'ministry-a' }]), updatedAt: '2026-09-29T00:00:00Z' },
      { profileId, key: 'authorization', encrypted: await codec.encrypt(profileId, 'authorization', { lease: lease() }), updatedAt: '2026-09-29T00:00:00Z' },
    ])
    const fetcher = vi.fn(async () => new Response(null, { status: 403 }))

    await expect(new SyncClient(db, codec, { fetcher }).syncProfile(profileId)).rejects.toThrow('Authenticate')

    expect((await db.profiles.get(profileId))?.requiresReauthentication).toBe(true)
    expect(await db.encryptedBlobs.where('profileId').equals(profileId).count()).toBe(0)
    expect(await db.outboxEvents.where('profileId').equals(profileId).count()).toBe(2)
  })
})
