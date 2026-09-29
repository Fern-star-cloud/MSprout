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

export class LocalProfileStore {
  private active: { profileId: string; key: CryptoKey } | null = null
  private autoLockTimer: ReturnType<typeof setTimeout> | null = null
  private readonly now: () => Date
  private readonly idleTimeoutMs: number
  private readonly createKeyMaterial: NonNullable<StoreOptions['createKeyMaterial']>
  private readonly unwrapKey: NonNullable<StoreOptions['unwrapKey']>
  private readonly db: OfflineDatabase
  private readonly activityHandler = () => this.recordActivity()
  private readonly visibilityHandler = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') this.lockAllProfiles()
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
    const profile = await this.db.profiles.get(profileId)
    if (!profile) throw new Error('Profile not found.')
    if (profile.retryAfter && Date.parse(profile.retryAfter) > this.now().getTime()) throw new Error('Try this PIN again later.')
    this.lockAllProfiles()
    try {
      const key = await this.unwrapKey(profile.id, pin, profile)
      this.active = { profileId, key }
      await this.db.profiles.update(profileId, { failedAttempts: 0, retryAfter: null })
      this.scheduleAutoLock()
    } catch {
      const attempts = profile.failedAttempts + 1
      const delay = Math.min(2 ** (attempts - 1), 300) * 1000
      await this.db.profiles.update(profileId, { failedAttempts: attempts, retryAfter: new Date(this.now().getTime() + delay).toISOString() })
      throw new Error('The local PIN is incorrect.')
    }
  }

  lockProfile(profileId: string): void {
    if (this.active?.profileId === profileId) this.lockAllProfiles()
  }

  private lockAllProfiles(): void {
    this.active = null
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer)
    this.autoLockTimer = null
  }

  isUnlocked(profileId: string): boolean {
    return this.active?.profileId === profileId
  }

  async activeProfile(): Promise<Pick<ProfileRecord, 'id' | 'churchId'> | null> {
    if (!this.active) return null
    const profile = await this.db.profiles.get(this.active.profileId)
    return profile ? { id: profile.id, churchId: profile.churchId } : null
  }

  recordActivity(): void {
    if (this.active) this.scheduleAutoLock()
  }

  private scheduleAutoLock(): void {
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer)
    this.autoLockTimer = setTimeout(() => this.lockAllProfiles(), this.idleTimeoutMs)
  }

  async switchProfile(profileId: string, pin: string, options: SwitchOptions): Promise<void> {
    if (this.active?.profileId === profileId) return
    if (options.online) {
      if (!options.signOut) throw new Error('Online profile switching must clear the server session.')
      await options.signOut()
    }
    this.lockAllProfiles()
    await this.unlockProfile(profileId, pin)
    await this.db.profiles.update(profileId, { requiresReauthentication: true })
  }

  async saveBootstrap(profileId: string, bootstrap: OfflineBootstrap): Promise<void> {
    const profile = await this.db.profiles.get(profileId)
    const key = this.keyFor(profileId)
    if (!profile) throw new Error('Profile not found.')
    if (bootstrap.actor.id !== profile.actorId) throw new Error('Server actor does not match this local profile.')
    assertLeaseMatchesProfile(profile, bootstrap.lease)
    const now = this.now().toISOString()
    const roster = await encryptPayload(profileId, 'roster', key, bootstrap.roster)
    const ministries = await encryptPayload(profileId, 'ministries', key, bootstrap.ministries)
    const authorization = await encryptPayload(profileId, 'authorization', key, { actor: bootstrap.actor, lease: bootstrap.lease })
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

    await this.db.transaction(
      'rw',
      [this.db.profiles, this.db.encryptedBlobs, this.db.serverCursors, this.db.attendanceDrafts, this.db.outboxEvents, this.db.conflicts],
      async () => {
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
        await this.db.serverCursors.put({ profileId, cursor: bootstrap.server_cursor, updatedAt: now })
        await this.db.profiles.update(profileId, {
          churchId: bootstrap.lease.church_id,
          leaseExpiresAt: bootstrap.lease.expires_at,
          leaseSignature: bootstrap.lease.signature,
          requiresReauthentication: false,
        })
      },
    )
  }

  async saveEncryptedRoster(profileId: string, roster: unknown): Promise<void> {
    const encrypted = await encryptPayload(profileId, 'roster', this.keyFor(profileId), roster)
    await this.db.encryptedBlobs.put({ profileId, key: 'roster', encrypted, updatedAt: this.now().toISOString() })
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

  private async readLeasedBlob<T>(profileId: string, purpose: string): Promise<T> {
    const key = this.keyFor(profileId)
    const profile = await this.db.profiles.get(profileId)
    if (!profile || !leaseIsValid(profile, this.now())) throw new Error('The offline authorization lease has expired.')
    const blob = await this.db.encryptedBlobs.get([profileId, purpose])
    if (!blob) throw new Error('The requested offline data is unavailable.')
    this.recordActivity()
    return decryptPayload<T>(profileId, purpose, key, blob.encrypted)
  }

  async isLeaseValid(profileId: string): Promise<boolean> {
    const profile = await this.db.profiles.get(profileId)
    return profile ? leaseIsValid(profile, this.now()) : false
  }

  async encryptLocalPayload(profileId: string, purpose: string, payload: unknown): Promise<EncryptedEnvelope> {
    const profile = await this.db.profiles.get(profileId)
    if (!profile || !leaseIsValid(profile, this.now())) throw new Error('The offline authorization lease has expired.')
    return encryptPayload(profileId, purpose, this.keyFor(profileId), payload)
  }

  async decryptLocalPayload<T>(profileId: string, purpose: string, envelope: EncryptedEnvelope): Promise<T> {
    const profile = await this.db.profiles.get(profileId)
    if (!profile || !leaseIsValid(profile, this.now())) throw new Error('The offline authorization lease has expired.')
    return decryptPayload<T>(profileId, purpose, this.keyFor(profileId), envelope)
  }

  async hasUnsafeLocalWork(): Promise<boolean> {
    return (await this.db.attendanceDrafts.count()) > 0 || (await this.db.outboxEvents.count()) > 0
  }

  async purgeProfile(profileId: string): Promise<void> {
    this.lockProfile(profileId)
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.db.profiles.delete(profileId)
      await this.db.encryptedBlobs.where('profileId').equals(profileId).delete()
      await this.db.attendanceDrafts.where('profileId').equals(profileId).delete()
      await this.db.outboxEvents.where('profileId').equals(profileId).delete()
      await this.db.serverCursors.delete(profileId)
      await this.db.conflicts.where('profileId').equals(profileId).delete()
      await this.db.metadata.where('profileId').equals(profileId).delete()
    })
  }

  async resetProfileAfterOnlineAuthentication(profileId: string, authenticatedOnline: boolean): Promise<void> {
    if (!authenticatedOnline) throw new Error('Online authentication is required to reset a profile.')
    await this.purgeProfile(profileId)
  }

  private keyFor(profileId: string): CryptoKey {
    if (!this.active || this.active.profileId !== profileId) throw new Error('This profile is locked.')
    return this.active.key
  }

  dispose(): void {
    this.lockAllProfiles()
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
