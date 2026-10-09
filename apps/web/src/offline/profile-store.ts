import { liveQuery, type Subscription } from 'dexie'
import { createProfileKeyMaterial, decryptPayload, encryptPayload, unwrapDataKey } from './crypto'
import { offlineDatabase, type OfflineDatabase } from './db'
import { assertLeaseMatchesProfile, isLeaseValid as leaseIsValid } from './lease'
import {
  PROFILE_IDLE_TIMEOUT_MS,
  type EncryptedEntityRecord,
  type EncryptedEnvelope,
  type OfflineBootstrap,
  type ProfileKeyMaterial,
  type ProfileRecord,
} from './schema'

interface StoredAttendanceDraft {
  id: string
  ministryId: string
}

interface StoredOutboxEvent {
  id: string
  entityId: string
}

interface StoreOptions {
  now?: () => Date
  idleTimeoutMs?: number
  createKeyMaterial?: (profileId: string, pin: string) => Promise<ProfileKeyMaterial>
  unwrapKey?: (profileId: string, pin: string, material: ProfileKeyMaterial) => Promise<CryptoKey>
}

interface CreateProfileInput {
  actorId: string
  churchId?: string
  pin: string
  deviceId?: string
}

interface SwitchOptions {
  online: boolean
  signOut?: () => Promise<void>
}

export type ProfileLockReason = 'manual' | 'background' | 'inactivity' | 'lease_expired' | 'profile_switch' | 'disposed'

export type ProfileRemovalAssessment = { status: 'ready' | 'locked' | 'blocked' | 'unknown' }

export class ProfilePinError extends Error {
  readonly reason: 'incorrect' | 'delay'
  readonly retryAfter: string

  constructor(reason: 'incorrect' | 'delay', retryAfter: string) {
    super(reason === 'incorrect' ? 'The local PIN is incorrect.' : 'Try this PIN again later.')
    this.reason = reason
    this.retryAfter = retryAfter
  }
}

export class LocalProfileStore {
  private active: { profileId: string; key: CryptoKey } | null = null
  private unlockGeneration = 0
  private pendingProfileId: string | null = null
  private profileWatch: Subscription | null = null
  private disposed = false
  private autoLockTimer: ReturnType<typeof setTimeout> | null = null
  private leaseLockTimer: ReturnType<typeof setTimeout> | null = null
  private readonly lockListeners = new Set<(profileId: string, reason: ProfileLockReason) => void>()
  private readonly now: () => Date
  private readonly idleTimeoutMs: number
  private readonly createKeyMaterial: NonNullable<StoreOptions['createKeyMaterial']>
  private readonly unwrapKey: NonNullable<StoreOptions['unwrapKey']>
  private readonly db: OfflineDatabase
  private readonly activityHandler = () => this.recordActivity()
  private readonly visibilityHandler = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') this.lockAllProfiles('background')
  }

  constructor(db: OfflineDatabase = offlineDatabase, options: StoreOptions = {}) {
    this.db = db
    this.now = options.now ?? (() => new Date())
    this.idleTimeoutMs = options.idleTimeoutMs ?? PROFILE_IDLE_TIMEOUT_MS
    this.createKeyMaterial = options.createKeyMaterial ?? createProfileKeyMaterial
    this.unwrapKey = options.unwrapKey ?? unwrapDataKey
    if (typeof globalThis.addEventListener === 'function') {
      for (const event of ['pointerdown', 'keydown', 'touchstart']) globalThis.addEventListener(event, this.activityHandler, { passive: true })
      globalThis.addEventListener('visibilitychange', this.visibilityHandler)
    }
  }

  async createProfile(input: CreateProfileInput): Promise<ProfileRecord> {
    if (!/^[a-z0-9_-]{1,64}$/i.test(input.actorId) || (input.churchId !== undefined && !/^[a-f\d-]{36}$/i.test(input.churchId))) {
      throw new Error('Invalid profile identity.')
    }
    const id = crypto.randomUUID()
    const keyMaterial = await this.createKeyMaterial(id, input.pin)
    const profile: ProfileRecord = {
      id, actorId: input.actorId, churchId: input.churchId ?? null, deviceId: input.deviceId ?? crypto.randomUUID(),
      createdAt: this.now().toISOString(), failedAttempts: 0, retryAfter: null,
      leaseExpiresAt: null, leaseSignature: null, requiresReauthentication: true, ...keyMaterial,
    }
    await this.db.profiles.add(profile)
    return profile
  }

  async listProfiles(): Promise<ProfileRecord[]> {
    return this.db.profiles.orderBy('createdAt').toArray()
  }

  async unlockProfile(profileId: string, pin: string): Promise<void> {
    if (this.disposed) throw new Error('This profile store is closed.')
    this.lockAllProfiles('profile_switch')
    const generation = this.unlockGeneration
    this.pendingProfileId = profileId
    const assertPending = () => {
      if (generation === this.unlockGeneration && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        this.lockAllProfiles('background')
      }
      if (generation !== this.unlockGeneration) throw new Error('This profile unlock was cancelled.')
    }
    try {
      const profile = await this.db.profiles.get(profileId)
      assertPending()
      if (!profile) throw new Error('Profile not found.')
      this.assertPinRetry(profile)
      let key: CryptoKey
      try {
        key = await this.unwrapKey(profile.id, pin, profile)
      } catch {
        assertPending()
        const retryAfter = await this.db.writeForProfile(profileId, [], async () => {
          assertPending()
          const current = (await this.db.profiles.get(profileId))!
          this.assertPinRetry(current)
          const attempts = current.failedAttempts + 1
          const delay = Math.min(2 ** (attempts - 1), 300) * 1000
          const retryAfter = new Date(this.now().getTime() + delay).toISOString()
          await this.db.profiles.update(profileId, { failedAttempts: attempts, retryAfter })
          assertPending()
          return retryAfter
        })
        throw new ProfilePinError('incorrect', retryAfter)
      }
      assertPending()
      await this.db.writeForProfile(profileId, [], async () => {
        assertPending()
        this.assertPinRetry((await this.db.profiles.get(profileId))!)
        await this.db.profiles.update(profileId, { failedAttempts: 0, retryAfter: null })
        assertPending()
      })
      assertPending()
      this.active = { profileId, key }
      const active = this.active
      this.profileWatch = liveQuery(() => this.db.profiles.get(profileId)).subscribe({
        next: current => { if (!current && this.active === active) this.lockProfile(profileId) },
        error: () => { if (this.active === active) this.lockProfile(profileId) },
      })
      this.scheduleAutoLock()
    } finally {
      if (generation === this.unlockGeneration) this.pendingProfileId = null
    }
  }

  private assertPinRetry(profile: ProfileRecord): void {
    if (profile.retryAfter && Date.parse(profile.retryAfter) > this.now().getTime()) throw new ProfilePinError('delay', profile.retryAfter)
  }

  lockProfile(profileId: string): void {
    if (this.active?.profileId === profileId || this.pendingProfileId === profileId) this.lockAllProfiles('manual')
  }

  private lockAllProfiles(reason: ProfileLockReason): void {
    const profileId = this.active?.profileId ?? this.pendingProfileId
    this.unlockGeneration += 1
    this.pendingProfileId = null
    this.active = null
    this.profileWatch?.unsubscribe()
    this.profileWatch = null
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer)
    this.autoLockTimer = null
    if (this.leaseLockTimer) clearTimeout(this.leaseLockTimer)
    this.leaseLockTimer = null
    if (profileId) for (const listener of this.lockListeners) listener(profileId, reason)
  }

  onLock(listener: (profileId: string, reason: ProfileLockReason) => void): () => void {
    this.lockListeners.add(listener)
    return () => { this.lockListeners.delete(listener) }
  }

  isUnlocked(profileId: string): boolean {
    return this.active?.profileId === profileId
  }

  async activeProfile(): Promise<Pick<ProfileRecord, 'id' | 'churchId' | 'syncNeedsPull'> | null> {
    const active = this.active
    if (!active) return null
    const profile = await this.db.profiles.get(active.profileId)
    if (this.active !== active) return null
    return profile ? { id: profile.id, churchId: profile.churchId, ...(profile.syncNeedsPull ? { syncNeedsPull: true } : {}) } : null
  }

  recordActivity(): void {
    if (this.active) this.scheduleAutoLock()
  }

  private scheduleAutoLock(): void {
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer)
    const active = this.active
    const timer = setTimeout(() => {
      if (this.active === active && this.autoLockTimer === timer) this.lockAllProfiles('inactivity')
    }, this.idleTimeoutMs)
    this.autoLockTimer = timer
  }

  async switchProfile(profileId: string, pin: string, options: SwitchOptions): Promise<void> {
    if (this.active?.profileId === profileId) return
    this.lockAllProfiles('profile_switch')
    const generation = this.unlockGeneration
    this.pendingProfileId = profileId
    try {
      if (options.online) {
        if (!options.signOut) throw new Error('Online profile switching must clear the server session.')
        await options.signOut()
      }
      if (generation !== this.unlockGeneration) throw new Error('This profile unlock was cancelled.')
      await this.unlockProfile(profileId, pin)
      const active = this.active
      await this.db.profiles.update(profileId, { requiresReauthentication: true })
      this.assertActive(active)
    } finally {
      if (generation === this.unlockGeneration) this.pendingProfileId = null
    }
  }

  async saveBootstrap(profileId: string, bootstrap: OfflineBootstrap, options: { preserveCursor?: boolean } = {}): Promise<void> {
    const active = this.active
    const profile = await this.db.profiles.get(profileId)
    this.assertActive(active)
    const key = this.keyFor(profileId)
    if (!profile) throw new Error('Profile not found.')
    if (bootstrap.actor.id !== profile.actorId) throw new Error('Server actor does not match this local profile.')
    assertLeaseMatchesProfile(profile, bootstrap.lease)
    const now = this.now().toISOString()
    const roster = await encryptPayload(profileId, 'roster', key, bootstrap.roster)
    const ministries = await encryptPayload(profileId, 'ministries', key, bootstrap.ministries)
    const authorization = await encryptPayload(profileId, 'authorization', key, { actor: bootstrap.actor, lease: bootstrap.lease, timezone: bootstrap.timezone })
    const authorizedMinistries = new Set(bootstrap.ministries.map(ministry => ministry.id))
    const drafts = await this.db.attendanceDrafts.where('profileId').equals(profileId).toArray()
    const revokedDraftIds = new Set<string>()
    const conflicts: EncryptedEntityRecord[] = []

    for (const record of drafts) {
      const draft = await decryptPayload<StoredAttendanceDraft>(profileId, `attendance-draft:${record.id}`, key, record.encrypted)
      if (authorizedMinistries.has(draft.ministryId)) continue
      revokedDraftIds.add(record.id)
      conflicts.push({
        profileId,
        id: `draft-${record.id}`,
        encrypted: await encryptPayload(profileId, `sync-conflict:draft-${record.id}`, key, {
          draft,
          status: 'rejected',
          reason: 'assignment_revoked',
          quarantinedAt: now,
        }),
        updatedAt: now,
      })
    }

    const outbox = await this.db.outboxEvents.where('profileId').equals(profileId).toArray()
    const revokedEventIds: string[] = []
    for (const record of outbox) {
      const event = await decryptPayload<StoredOutboxEvent>(profileId, `outbox-event:${record.id}`, key, record.encrypted)
      if (!revokedDraftIds.has(event.entityId)) continue
      revokedEventIds.push(record.id)
      conflicts.push({
        profileId,
        id: record.id,
        encrypted: await encryptPayload(profileId, `sync-conflict:${record.id}`, key, {
          event,
          status: 'rejected',
          reason: 'assignment_revoked',
          quarantinedAt: now,
        }),
        updatedAt: now,
      })
    }

    await this.db.writeForProfile(
      profileId,
      [this.db.profiles, this.db.encryptedBlobs, this.db.serverCursors, this.db.attendanceDrafts, this.db.outboxEvents, this.db.conflicts],
      async () => {
        this.assertActive(active)
        await this.db.encryptedBlobs.bulkPut([
          { profileId, key: 'roster', encrypted: roster, updatedAt: now },
          { profileId, key: 'ministries', encrypted: ministries, updatedAt: now },
          { profileId, key: 'authorization', encrypted: authorization, updatedAt: now },
        ])
        if (conflicts.length > 0) await this.db.conflicts.bulkPut(conflicts)
        if (revokedDraftIds.size > 0) {
          await this.db.attendanceDrafts.bulkDelete([...revokedDraftIds].map(id => [profileId, id]))
        }
        if (revokedEventIds.length > 0) {
          await this.db.outboxEvents.bulkDelete(revokedEventIds.map(id => [profileId, id]))
        }
        // Recovery must download from the last locally applied page. Bootstrap's
        // newest roster cursor does not prove attendance projections were applied.
        const cursor = options.preserveCursor ? await this.db.serverCursors.get(profileId) : undefined
        await this.db.serverCursors.put({ profileId, cursor: cursor?.cursor ?? bootstrap.server_cursor, updatedAt: now })
        await this.db.profiles.update(profileId, {
          churchId: bootstrap.lease.church_id,
          leaseExpiresAt: bootstrap.lease.expires_at,
          leaseSignature: bootstrap.lease.signature,
          requiresReauthentication: false,
        })
        this.assertActive(active)
      },
    )
    this.assertActive(active)
    if (leaseIsValid({ leaseExpiresAt: bootstrap.lease.expires_at }, this.now())) {
      this.scheduleLeaseLock(active!, bootstrap.lease.expires_at)
    }
  }

  async invalidateAuthorization(profileId: string): Promise<void> {
    await this.db.transaction('rw', [this.db.profiles, this.db.encryptedBlobs], async () => {
      await this.db.profiles.update(profileId, { requiresReauthentication: true })
      await this.db.encryptedBlobs.bulkDelete([
        [profileId, 'roster'],
        [profileId, 'ministries'],
        [profileId, 'authorization'],
      ])
    })
  }

  async saveEncryptedRoster(profileId: string, roster: unknown): Promise<void> {
    const active = this.active
    const encrypted = await encryptPayload(profileId, 'roster', this.keyFor(profileId), roster)
    await this.db.writeForProfile(profileId, [this.db.encryptedBlobs], async () => {
      this.assertActive(active)
      await this.db.encryptedBlobs.put({ profileId, key: 'roster', encrypted, updatedAt: this.now().toISOString() })
      this.assertActive(active)
    })
  }

  async readEncryptedRoster<T = unknown>(profileId: string): Promise<T> {
    return this.readLeasedBlob<T>(profileId, 'roster')
  }

  async readEncryptedMinistries<T = unknown>(profileId: string): Promise<T> {
    return this.readLeasedBlob<T>(profileId, 'ministries')
  }

  async readEncryptedAuthorization<T = unknown>(profileId: string): Promise<T> {
    return this.readLeasedBlob<T>(profileId, 'authorization')
  }

  captureSyncAuthorization(profileId: string): { assertCurrent: () => Promise<void>; assertUnlocked: () => void } {
    const active = this.active
    const key = this.keyFor(profileId)
    return {
      assertUnlocked: () => { this.assertActive(active) },
      assertCurrent: async () => {
        this.assertActive(active)
        await this.assertCurrentAuthorization(profileId, key)
        this.assertActive(active)
      },
    }
  }

  private async readLeasedBlob<T>(profileId: string, purpose: string): Promise<T> {
    const active = this.active
    const key = this.keyFor(profileId)
    await this.assertCurrentAuthorization(profileId, key)
    const blob = await this.db.encryptedBlobs.get([profileId, purpose])
    if (!blob) throw new Error('The requested offline data is unavailable.')
    const payload = await decryptPayload<T>(profileId, purpose, key, blob.encrypted)
    this.assertActive(active)
    this.recordActivity()
    return payload
  }

  async isLeaseValid(profileId: string): Promise<boolean> {
    try {
      await this.assertCurrentAuthorization(profileId, this.keyFor(profileId))
      return true
    } catch {
      return false
    }
  }

  private async assertCurrentAuthorization(profileId: string, key: CryptoKey): Promise<void> {
    const active = this.active
    if (!active || active.profileId !== profileId || active.key !== key) throw new Error('This profile is locked.')
    const profile = await this.db.profiles.get(profileId)
    if (!profile || !leaseIsValid(profile, this.now())) throw new Error('The offline authorization lease has expired.')
    const blob = await this.db.encryptedBlobs.get([profileId, 'authorization'])
    if (!blob) throw new Error('The requested offline data is unavailable.')
    const authorization = await decryptPayload<{ actor: { id: string }; lease: OfflineBootstrap['lease'] }>(profileId, 'authorization', key, blob.encrypted)
    assertLeaseMatchesProfile(profile, authorization.lease)
    // Clear profile metadata is only an index. Authority comes from the authenticated encrypted lease.
    if (authorization.actor.id !== profile.actorId
      || profile.leaseSignature !== authorization.lease.signature
      || !leaseIsValid({ leaseExpiresAt: authorization.lease.expires_at }, this.now())) {
      throw new Error('The offline authorization lease has expired.')
    }
    // A read from an earlier unlock or authorization must not affect the current key or timer.
    const [currentProfile, currentBlob] = await Promise.all([
      this.db.profiles.get(profileId), this.db.encryptedBlobs.get([profileId, 'authorization']),
    ])
    this.assertActive(active)
    if (!leaseIsValid({ leaseExpiresAt: authorization.lease.expires_at }, this.now())) throw new Error('The offline authorization lease has expired.')
    if (!currentProfile || currentProfile.leaseSignature !== profile.leaseSignature
      || currentProfile.leaseExpiresAt !== profile.leaseExpiresAt
      || currentBlob?.encrypted.ciphertext !== blob.encrypted.ciphertext
      || currentBlob?.encrypted.iv !== blob.encrypted.iv) throw new Error('The offline authorization changed. Try again.')
    // Use the authenticated encrypted expiry, never the editable clear index, to expire an open view.
    this.scheduleLeaseLock(active, authorization.lease.expires_at)
  }

  private scheduleLeaseLock(active: NonNullable<typeof this.active>, expiresAt: string): void {
    if (this.leaseLockTimer) clearTimeout(this.leaseLockTimer)
    const timer = setTimeout(() => {
      // Expiry must purge the key even if IndexedDB is blocked or unavailable.
      if (this.active === active && this.leaseLockTimer === timer) this.lockAllProfiles('lease_expired')
    }, Math.min(Math.max(0, Date.parse(expiresAt) - this.now().getTime()), 2 ** 31 - 1))
    this.leaseLockTimer = timer
  }

  async encryptLocalPayload(profileId: string, purpose: string, payload: unknown): Promise<EncryptedEnvelope> {
    const active = this.active
    const key = this.keyFor(profileId)
    await this.assertCurrentAuthorization(profileId, key)
    const encrypted = await encryptPayload(profileId, purpose, key, payload)
    this.assertActive(active)
    return encrypted
  }

  async decryptLocalPayload<T>(profileId: string, purpose: string, envelope: EncryptedEnvelope): Promise<T> {
    const active = this.active
    const key = this.keyFor(profileId)
    await this.assertCurrentAuthorization(profileId, key)
    const payload = await decryptPayload<T>(profileId, purpose, key, envelope)
    this.assertActive(active)
    return payload
  }

  async hasUnsafeLocalWork(): Promise<boolean> {
    return (await this.db.attendanceDrafts.count()) > 0 || (await this.db.outboxEvents.count()) > 0
  }

  private removalSnapshot(profileId: string) {
    return this.db.transaction('r', this.db.tables, async () => ({
      profile: await this.db.profiles.get(profileId),
      blobs: await this.db.encryptedBlobs.where('profileId').equals(profileId).toArray(),
      drafts: await this.db.attendanceDrafts.where('profileId').equals(profileId).toArray(),
      outbox: await this.db.outboxEvents.where('profileId').equals(profileId).toArray(),
      conflicts: await this.db.conflicts.where('profileId').equals(profileId).toArray(),
      cursor: await this.db.serverCursors.get(profileId),
      metadata: await this.db.metadata.where('profileId').equals(profileId).toArray(),
    }))
  }

  private async verifyRemoval(profileId: string, snapshot: Awaited<ReturnType<LocalProfileStore['removalSnapshot']>>): Promise<ProfileRemovalAssessment> {
    if (!this.isUnlocked(profileId)) return { status: 'locked' }
    const { profile, blobs, drafts, outbox, conflicts, cursor, metadata } = snapshot
    if (!profile) return { status: 'unknown' }
    if (drafts.length || outbox.length || conflicts.length) return { status: 'blocked' }
    if (metadata.length || blobs.some(blob => !['roster', 'ministries', 'authorization'].includes(blob.key))) return { status: 'unknown' }
    // A never-prepared, genuinely empty profile is known empty. Partial preparation
    // and older profiles without explicit download-completion proof fail closed.
    if (!blobs.length && !cursor && profile.leaseExpiresAt === null && profile.leaseSignature === null
      && profile.syncNeedsPull === undefined && profile.requiresReauthentication === true) return { status: 'ready' }
    if (profile.syncNeedsPull !== false || profile.requiresReauthentication !== false || !cursor
      || !/^\d+$/.test(cursor.cursor) || blobs.length !== 3) return { status: 'unknown' }
    const active = this.active
    await this.assertCurrentAuthorization(profileId, this.keyFor(profileId))
    for (const blob of blobs) {
      const value = await decryptPayload<unknown>(profileId, blob.key, this.keyFor(profileId), blob.encrypted)
      if (blob.key !== 'authorization' && !Array.isArray(value)) return { status: 'unknown' }
    }
    this.assertActive(active)
    return { status: 'ready' }
  }

  async assessRemoval(profileId: string): Promise<ProfileRemovalAssessment> {
    if (!this.isUnlocked(profileId)) return { status: 'locked' }
    try { return await this.verifyRemoval(profileId, await this.removalSnapshot(profileId)) }
    catch { return { status: 'unknown' } }
  }

  async purgeProfile(profileId: string, confirmation?: { confirmedProfileId: string }): Promise<void> {
    if (confirmation?.confirmedProfileId !== profileId) throw new Error('Confirm the selected profile before removal.')
    const active = this.active
    const snapshot = await this.removalSnapshot(profileId)
    if ((await this.verifyRemoval(profileId, snapshot)).status !== 'ready') throw new Error('This profile must be preserved. Removal safety could not be verified.')
    this.assertActive(active)
    await this.db.transaction('rw', this.db.tables, async () => {
      this.assertActive(active)
      // Crypto runs outside IndexedDB transactions. Recheck every preservation
      // input under the exclusive transaction shared with all domain writers.
      if (JSON.stringify(await this.removalSnapshot(profileId)) !== JSON.stringify(snapshot)) throw new Error('The profile changed. No data was removed. Check again.')
      if (snapshot.profile?.leaseExpiresAt && !leaseIsValid(snapshot.profile, this.now())) throw new Error('Authorization expired. Keep this profile.')
      this.assertActive(active)
      await this.db.profiles.delete(profileId)
      await this.db.encryptedBlobs.where('profileId').equals(profileId).delete()
      await this.db.attendanceDrafts.where('profileId').equals(profileId).delete()
      await this.db.outboxEvents.where('profileId').equals(profileId).delete()
      await this.db.serverCursors.delete(profileId)
      await this.db.conflicts.where('profileId').equals(profileId).delete()
      await this.db.metadata.where('profileId').equals(profileId).delete()
      this.assertActive(active)
    })
    this.lockProfile(profileId)
  }

  async resetProfileAfterOnlineAuthentication(_profileId: string, authenticatedOnline: boolean): Promise<void> {
    if (!authenticatedOnline) throw new Error('Online authentication is required to reset a profile.')
    throw new Error('A church sign-in cannot reset the local PIN. Keep this profile and its encrypted work.')
  }

  private keyFor(profileId: string): CryptoKey {
    if (!this.active || this.active.profileId !== profileId) throw new Error('This profile is locked.')
    return this.active.key
  }

  private assertActive(active: typeof this.active): void {
    if (!active || this.active !== active) throw new Error('This profile is locked.')
  }

  dispose(): void {
    this.disposed = true
    this.lockAllProfiles('disposed')
    this.lockListeners.clear()
    if (typeof globalThis.removeEventListener === 'function') {
      for (const event of ['pointerdown', 'keydown', 'touchstart']) globalThis.removeEventListener(event, this.activityHandler)
      globalThis.removeEventListener('visibilitychange', this.visibilityHandler)
    }
  }
}

export const profileStore = new LocalProfileStore()
export const createProfile = profileStore.createProfile.bind(profileStore)
export const unlockProfile = profileStore.unlockProfile.bind(profileStore)
export const lockProfile = profileStore.lockProfile.bind(profileStore)
export const switchProfile = profileStore.switchProfile.bind(profileStore)
export const purgeProfile = profileStore.purgeProfile.bind(profileStore)
export const isLeaseValid = profileStore.isLeaseValid.bind(profileStore)
