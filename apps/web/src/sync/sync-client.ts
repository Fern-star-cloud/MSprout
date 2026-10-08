import type { EncryptedEnvelope, OfflineLease, ProfileRecord } from '../offline/schema'
import { offlineDatabase, type OfflineDatabase } from '../offline/db'
import { assertLeaseMatchesProfile } from '../offline/lease'
import { profileStore } from '../offline/profile-store'
import type { AttendanceDraft, AttendanceState, LocalAttendanceEvent } from '../features/attendance/domain'
import { ProfileOutbox, type OutboxCodec, type SyncEventResult } from './outbox'

export interface SyncProfileAccess extends OutboxCodec {
  isUnlocked(profileId: string): boolean
  captureSyncAuthorization?: (profileId: string) => { assertCurrent: () => Promise<void>; assertUnlocked: () => void }
  authorizationRenewed?: (profileId: string) => Promise<void>
}

export interface SyncSummary {
  pushed: number
  acknowledged: number
  conflicts: number
  rejected: number
  pulled: number
  nextCursor: string
}

interface SyncChange {
  sequence: string
  entity_type: 'attendance_session' | 'ministry_assignment'
  entity_id: string
  version: number
  action: 'upsert' | 'tombstone'
  ministry_id: string | null
  payload: Record<string, unknown> | null
}

interface PushResponse { results: SyncEventResult[] }
interface PullResponse {
  changes: SyncChange[]
  page: { next_cursor: string; has_more: boolean }
  lease: OfflineLease
}

interface ClientOptions {
  fetcher?: typeof fetch
  uuid?: () => string
  sleep?: (milliseconds: number) => Promise<void>
  random?: () => number
  now?: () => Date
  maxAttempts?: number
}

const defaultAccess: SyncProfileAccess = {
  isUnlocked: (profileId) => profileStore.isUnlocked(profileId),
  captureSyncAuthorization: (profileId) => profileStore.captureSyncAuthorization(profileId),
  authorizationRenewed: async (profileId) => { await profileStore.readEncryptedAuthorization(profileId) },
  encrypt: (profileId, purpose, value) => profileStore.encryptLocalPayload(profileId, purpose, value),
  decrypt: (profileId, purpose, envelope) => profileStore.decryptLocalPayload(profileId, purpose, envelope),
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class SyncClient {
  private readonly db: OfflineDatabase
  private readonly access: SyncProfileAccess
  private readonly fetcher: typeof fetch
  private readonly uuid: () => string
  private readonly sleep: (milliseconds: number) => Promise<void>
  private readonly random: () => number
  private readonly now: () => Date
  private readonly maxAttempts: number
  private readonly outbox: ProfileOutbox
  private readonly inFlight = new Map<string, Promise<SyncSummary>>()

  constructor(
    db: OfflineDatabase = offlineDatabase,
    access: SyncProfileAccess = defaultAccess,
    options: ClientOptions = {},
  ) {
    this.db = db
    this.access = access
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis)
    this.uuid = options.uuid ?? (() => globalThis.crypto.randomUUID())
    this.sleep = options.sleep ?? ((milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds)))
    this.random = options.random ?? Math.random
    this.now = options.now ?? (() => new Date())
    this.maxAttempts = options.maxAttempts ?? 3
    this.outbox = new ProfileOutbox(db, access)
  }

  syncProfile(profileId: string): Promise<SyncSummary> {
    const existing = this.inFlight.get(profileId)
    if (existing) return existing
    const running = this.runSyncProfile(profileId).finally(() => { this.inFlight.delete(profileId) })
    this.inFlight.set(profileId, running)
    return running
  }

  private async runSyncProfile(profileId: string): Promise<SyncSummary> {
    if (!this.access.isUnlocked(profileId)) throw new Error('The selected profile must be unlocked before synchronization.')
    const captured = this.access.captureSyncAuthorization?.(profileId)
    const assertUnlocked = () => {
      if (!this.access.isUnlocked(profileId)) throw new Error('This profile is locked.')
      captured?.assertUnlocked()
    }
    const assertAccess = async () => {
      assertUnlocked()
      await captured?.assertCurrent()
    }
    const profile = await this.db.profiles.get(profileId)
    if (!profile?.churchId) throw new Error('The selected profile is not ready for synchronization.')
    if (profile.requiresReauthentication) throw new Error('Authenticate online as this profile before synchronizing.')
    await assertAccess()

    // Upload acknowledgement does not complete the download/lease-renewal phase.
    // Persist before sending so interruption cannot make an empty outbox imply completion.
    await this.db.profiles.update(profileId, { syncNeedsPull: true })

    const summary: SyncSummary = { pushed: 0, acknowledged: 0, conflicts: 0, rejected: 0, pulled: 0, nextCursor: '0' }
    const events = await this.outbox.list(profileId)
    for (let offset = 0; offset < events.length; offset += 100) {
      const chunk = events.slice(offset, offset + 100)
      const response = await this.request<PushResponse>('/api/sync/push', profile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: profile.deviceId,
          batch_id: this.uuid(),
          events: chunk.map(event => this.pushProjection(event)),
        }),
      }, assertAccess)
      if (!Array.isArray(response.results) || response.results.length !== chunk.length) {
        throw new Error('The synchronization acknowledgement is incomplete.')
      }
      const expectedIds = [...chunk.map(event => event.id)].sort()
      const resultIds = [...response.results.map(result => result.client_event_id)].sort()
      if (expectedIds.some((id, index) => id !== resultIds[index])) {
        throw new Error('The synchronization acknowledgement does not match the submitted batch.')
      }
      const settled = await this.outbox.settle(profileId, response.results, this.now().toISOString())
      summary.pushed += chunk.length
      summary.acknowledged += settled.acknowledged
      summary.conflicts += settled.conflicts
      summary.rejected += settled.rejected
    }

    let cursor = (await this.db.serverCursors.get(profileId))?.cursor ?? '0'
    let hasMore: boolean
    do {
      const response = await this.request<PullResponse>(`/api/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=100`, profile, {
        method: 'GET',
        headers: { 'X-Device-Id': profile.deviceId },
      }, assertAccess)
      this.validatePull(response, cursor)
      await this.applyPull(profile, response, assertAccess, assertUnlocked)
      summary.pulled += response.changes.length
      cursor = response.page.next_cursor
      hasMore = response.page.has_more
    } while (hasMore)
    summary.nextCursor = cursor
    await assertAccess()
    await this.db.transaction('rw', this.db.profiles, async () => {
      assertUnlocked()
      await this.db.profiles.update(profileId, { syncNeedsPull: false })
      assertUnlocked()
    })

    return summary
  }

  private pushProjection(event: LocalAttendanceEvent) {
    return {
      client_event_id: event.id,
      entity_id: event.entityId,
      action: event.action,
      base_version: event.baseVersion,
      occurred_at: event.occurredAt,
      payload: event.payload,
    }
  }

  private async request<T>(url: string, profile: ProfileRecord, init: RequestInit, assertAccess: () => Promise<void>): Promise<T> {
    await assertAccess()
    const csrfToken = init.method === 'POST' ? await this.csrfToken() : null
    let lastError: unknown
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      try {
        await assertAccess()
        const response = await this.fetcher(url, {
          ...init,
          credentials: 'include',
          referrerPolicy: 'origin',
          cache: 'no-store',
          redirect: 'error',
          headers: {
            Accept: 'application/json',
            'X-Church-Id': profile.churchId!,
            ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
            ...init.headers,
          },
        })
        await assertAccess()
        if (response.status === 401 || response.status === 403) {
          await this.db.transaction('rw', this.db.profiles, this.db.encryptedBlobs, async () => {
            await this.db.profiles.update(profile.id, { requiresReauthentication: true })
            await this.db.encryptedBlobs.bulkDelete([
              [profile.id, 'roster'],
              [profile.id, 'ministries'],
              [profile.id, 'authorization'],
            ])
          })
          throw new Error('Authenticate online as this profile before synchronizing.')
        }
        if (!response.ok) {
          if (response.status !== 429 && response.status < 500) throw new Error('Synchronization was rejected by the server.')
          throw new RetryableSyncError()
        }

        return await response.json() as T
      } catch (error) {
        if (error instanceof Error && error.message.includes('Authenticate online')) throw error
        lastError = error
        if (attempt + 1 >= this.maxAttempts || (error instanceof Error && !(error instanceof RetryableSyncError) && !(error instanceof TypeError))) break
        const base = 250 * (2 ** attempt)
        await this.sleep(base + Math.floor(base * 0.25 * this.random()))
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Synchronization failed after bounded retries.')
  }

  private async csrfToken(): Promise<string | null> {
    if (typeof document === 'undefined') return null
    const read = () => {
      const cookie = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN='))
      return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : null
    }
    const existing = read()
    if (existing) return existing
    const response = await this.fetcher('/sanctum/csrf-cookie', {
      method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'origin', headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error('Online session protection could not be initialized.')
    return read()
  }

  private validatePull(response: PullResponse, previousCursor: string): void {
    if (!Array.isArray(response.changes) || !isObject(response.page) || typeof response.page.next_cursor !== 'string'
      || typeof response.page.has_more !== 'boolean' || !/^\d+$/.test(response.page.next_cursor)
      || BigInt(response.page.next_cursor) < BigInt(previousCursor) || !isObject(response.lease)) {
      throw new Error('The synchronization pull response is invalid.')
    }
    let sequence = BigInt(previousCursor)
    for (const change of response.changes) {
      if (!/^\d+$/.test(change.sequence) || BigInt(change.sequence) <= sequence) throw new Error('Synchronization changes are not ordered.')
      sequence = BigInt(change.sequence)
    }
    if (sequence > BigInt(response.page.next_cursor)) throw new Error('The synchronization cursor precedes a returned change.')
    if (response.page.has_more && BigInt(response.page.next_cursor) === BigInt(previousCursor)) {
      throw new Error('The synchronization cursor must advance when more pages remain.')
    }
  }

  private async applyPull(profile: ProfileRecord, response: PullResponse, assertAccess: () => Promise<void>, assertUnlocked: () => void): Promise<void> {
    await assertAccess()
    assertLeaseMatchesProfile(profile, response.lease)
    const now = this.now().toISOString()
    const draftPuts: Array<{ profileId: string; id: string; encrypted: EncryptedEnvelope; updatedAt: string }> = []
    const draftDeletes: Array<[string, string]> = []
    const outboxDeletes: Array<[string, string]> = []
    const conflictPuts: Array<{ profileId: string; id: string; encrypted: EncryptedEnvelope; updatedAt: string }> = []
    let rosterValues: Array<Record<string, unknown>> | null = null
    let ministryValues: Array<{ id: string }> | null = null
    let rosterChanged = false
    let ministriesChanged = false

    for (const change of response.changes) {
      if (change.entity_type === 'attendance_session' && change.action === 'upsert') {
        const stored = await this.db.attendanceDrafts.get([profile.id, change.entity_id])
        if (!stored || !isObject(change.payload) || !Array.isArray(change.payload.records)) continue
        const draft = await this.access.decrypt<AttendanceDraft>(profile.id, `attendance-draft:${change.entity_id}`, stored.encrypted)
        const states = new Map((change.payload.records as Array<Record<string, unknown>>).map(record => [record.student_id, record.state]))
        for (const entry of draft.entries) {
          const state = states.get(entry.studentId)
          if (state === 'unmarked' || state === 'present' || state === 'absent') entry.state = state as AttendanceState
        }
        if (Array.isArray(change.payload.guests)) {
          draft.guests = (change.payload.guests as Array<Record<string, unknown>>).flatMap((guest) => {
            if (typeof guest.id !== 'string' || typeof guest.display_name !== 'string'
              || !['male', 'female', 'unspecified'].includes(String(guest.gender))
              || !['pending', 'promoted', 'linked', 'merged'].includes(String(guest.status))) return []
            return [{
              id: guest.id,
              displayName: guest.display_name,
              gender: guest.gender as 'male' | 'female' | 'unspecified',
              state: 'present' as const,
              status: guest.status as 'pending' | 'promoted' | 'linked' | 'merged',
            }]
          })
        } else {
          draft.guests ??= []
        }
        const status = change.payload.status
        if (status === 'draft' || status === 'finalized' || status === 'needs_review' || status === 'revised') draft.status = status
        draft.version = change.version
        draft.updatedAt = now
        draftPuts.push({
          profileId: profile.id,
          id: draft.id,
          encrypted: await this.access.encrypt(profile.id, `attendance-draft:${draft.id}`, draft),
          updatedAt: now,
        })
      }
      if (change.entity_type === 'ministry_assignment' && change.action === 'tombstone' && change.ministry_id) {
        await this.prepareRevocation(profile.id, change.ministry_id, now, draftDeletes, outboxDeletes, conflictPuts)
        if (rosterValues === null) {
          const roster = await this.db.encryptedBlobs.get([profile.id, 'roster'])
          rosterValues = roster ? await this.access.decrypt<Array<Record<string, unknown>>>(profile.id, 'roster', roster.encrypted) : []
        }
        if (rosterValues.length > 0) {
          rosterValues = rosterValues.map(student => ({
            ...student,
            ministry_ids: Array.isArray(student.ministry_ids) ? student.ministry_ids.filter(id => id !== change.ministry_id) : [],
          })).filter(student => student.ministry_ids.length > 0)
          rosterChanged = true
        }
        if (ministryValues === null) {
          const ministries = await this.db.encryptedBlobs.get([profile.id, 'ministries'])
          ministryValues = ministries ? await this.access.decrypt<Array<{ id: string }>>(profile.id, 'ministries', ministries.encrypted) : []
        }
        if (ministryValues.length > 0) {
          ministryValues = ministryValues.filter(value => value.id !== change.ministry_id)
          ministriesChanged = true
        }
      }
    }

    const authorization = await this.access.encrypt(profile.id, 'authorization', { actor: { id: profile.actorId }, lease: response.lease })
    const rosterPut = rosterChanged && rosterValues !== null
      ? { profileId: profile.id, key: 'roster', encrypted: await this.access.encrypt(profile.id, 'roster', rosterValues), updatedAt: now }
      : null
    const ministriesPut = ministriesChanged && ministryValues !== null
      ? { profileId: profile.id, key: 'ministries', encrypted: await this.access.encrypt(profile.id, 'ministries', ministryValues), updatedAt: now }
      : null
    await assertAccess()
    await this.db.transaction('rw', [this.db.profiles, this.db.encryptedBlobs, this.db.attendanceDrafts, this.db.outboxEvents, this.db.conflicts, this.db.serverCursors], async () => {
      // Crypto/lease checks completed before the transaction; check the key remains
      // present without introducing crypto waits into the IndexedDB transaction.
      assertUnlocked()
      if (draftPuts.length > 0) await this.db.attendanceDrafts.bulkPut(draftPuts)
      if (draftDeletes.length > 0) await this.db.attendanceDrafts.bulkDelete(draftDeletes)
      if (outboxDeletes.length > 0) await this.db.outboxEvents.bulkDelete(outboxDeletes)
      if (conflictPuts.length > 0) await this.db.conflicts.bulkPut(conflictPuts)
      if (rosterPut) await this.db.encryptedBlobs.put(rosterPut)
      if (ministriesPut) await this.db.encryptedBlobs.put(ministriesPut)
      await this.db.encryptedBlobs.put({ profileId: profile.id, key: 'authorization', encrypted: authorization, updatedAt: now })
      await this.db.serverCursors.put({ profileId: profile.id, cursor: response.page.next_cursor, updatedAt: now })
      await this.db.profiles.update(profile.id, {
        leaseExpiresAt: response.lease.expires_at,
        leaseSignature: response.lease.signature,
        requiresReauthentication: false,
      })
      assertUnlocked()
    })
    await this.access.authorizationRenewed?.(profile.id)
  }

  private async prepareRevocation(
    profileId: string,
    ministryId: string,
    now: string,
    draftDeletes: Array<[string, string]>,
    outboxDeletes: Array<[string, string]>,
    conflictPuts: Array<{ profileId: string; id: string; encrypted: EncryptedEnvelope; updatedAt: string }>,
  ): Promise<void> {
    const drafts = await this.db.attendanceDrafts.where('profileId').equals(profileId).toArray()
    const revokedDraftIds = new Set<string>()
    for (const stored of drafts) {
      const draft = await this.access.decrypt<AttendanceDraft>(profileId, `attendance-draft:${stored.id}`, stored.encrypted)
      if (draft.ministryId !== ministryId) continue
      revokedDraftIds.add(draft.id)
      const id = `draft-${draft.id}`
      conflictPuts.push({
        profileId, id,
        encrypted: await this.access.encrypt(profileId, `sync-conflict:${id}`, { draft, status: 'rejected', reason: 'assignment_revoked', quarantinedAt: now }),
        updatedAt: now,
      })
      draftDeletes.push([profileId, draft.id])
    }
    const events = await this.outbox.list(profileId)
    for (const event of events) {
      if (!revokedDraftIds.has(event.entityId)) continue
      conflictPuts.push({
        profileId, id: event.id,
        encrypted: await this.access.encrypt(profileId, `sync-conflict:${event.id}`, { event, status: 'rejected', reason: 'assignment_revoked', quarantinedAt: now }),
        updatedAt: now,
      })
      outboxDeletes.push([profileId, event.id])
    }
  }
}

class RetryableSyncError extends Error {}

export const syncClient = new SyncClient()
export const syncProfile = syncClient.syncProfile.bind(syncClient)
