import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOfflineDatabase, type OfflineDatabase } from './db'
import { LocalProfileStore } from './profile-store'
import { PROFILE_IDLE_TIMEOUT_MS, type ProfileKeyMaterial } from './schema'

const lease = (profileId: string, actorId: string, deviceId: string, expiresAt: string) => ({
  profile_id: profileId,
  actor_id: actorId,
  church_id: '00000000-0000-4000-8000-000000000010',
  device_id: deviceId,
  membership_id: '00000000-0000-4000-8000-000000000020',
  issued_at: '2026-09-28T00:00:00Z',
  expires_at: expiresAt,
  signature: 'a'.repeat(64),
})

describe('isolated local profiles', () => {
  let db: OfflineDatabase
  let store: LocalProfileStore
  let storeOptions: ConstructorParameters<typeof LocalProfileStore>[1]

  beforeEach(() => {
    db = createOfflineDatabase(`profile-test-${crypto.randomUUID()}`)
    const keys = new Map<string, { pin: string; key: CryptoKey }>()
    const placeholder: ProfileKeyMaterial = {
      salt: 'AAAAAAAAAAAAAAAAAAAAAA==', iterations: 600_000,
      wrappedDataKey: { algorithm: 'AES-256-GCM', iv: 'AAAAAAAAAAAAAAAA', ciphertext: 'unused', schemaVersion: 1 },
    }
    storeOptions = {
      now: () => new Date('2026-09-28T00:00:00Z'),
      createKeyMaterial: async (profileId, pin) => {
        keys.set(profileId, { pin, key: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) })
        return placeholder
      },
      unwrapKey: async (profileId, pin) => {
        const entry = keys.get(profileId)
        if (!entry || entry.pin !== pin) throw new Error('Wrong PIN')
        return entry.key
      },
    }
    store = new LocalProfileStore(db, storeOptions)
  })

  afterEach(async () => {
    store.dispose()
    await db.delete()
    vi.useRealTimers()
  })

  it('clears the raw key from memory when a profile locks', async () => {
    const profile = await store.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    await store.unlockProfile(profile.id, '184629')
    expect(store.isUnlocked(profile.id)).toBe(true)

    store.lockProfile(profile.id)
    expect(store.isUnlocked(profile.id)).toBe(false)
    await expect(store.readEncryptedRoster(profile.id)).rejects.toThrow('locked')
  })

  it('notifies the open view after clearing the key and allows observers to unsubscribe', async () => {
    const profile = await store.createProfile({ actorId: '11', pin: '184629' })
    await store.unlockProfile(profile.id, '184629')
    const listener = vi.fn(() => expect(store.isUnlocked(profile.id)).toBe(false))
    const unsubscribe = store.onLock(listener)
    store.lockProfile(profile.id)
    expect(listener).toHaveBeenCalledWith(profile.id)
    unsubscribe()
    await store.unlockProfile(profile.id, '184629')
    store.lockProfile(profile.id)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('expires an open profile using its authenticated lease and not a tampered clear expiry', async () => {
    const timedStore = new LocalProfileStore(db, { ...storeOptions, idleTimeoutMs: 10_000 })
    const profile = await timedStore.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    await timedStore.unlockProfile(profile.id, '184629')
    await timedStore.saveBootstrap(profile.id, {
      actor: { id: '11' }, ministries: [], roster: [], server_cursor: '1',
      lease: lease(profile.id, '11', profile.deviceId, '2026-09-28T00:00:00.050Z'),
    })
    await db.profiles.update(profile.id, { leaseExpiresAt: '2099-01-01T00:00:00Z' })
    await timedStore.readEncryptedRoster(profile.id)
    await new Promise(resolve => setTimeout(resolve, 80))
    expect(timedStore.isUnlocked(profile.id)).toBe(false)
    timedStore.dispose()
  })

  it('auto-locks five minutes after the last recorded activity', async () => {
    expect(PROFILE_IDLE_TIMEOUT_MS).toBe(5 * 60 * 1000)
    const timedStore = new LocalProfileStore(db, { ...storeOptions, now: () => new Date(), idleTimeoutMs: 50 })
    const profile = await timedStore.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    await timedStore.unlockProfile(profile.id, '184629')
    await new Promise((resolve) => setTimeout(resolve, 30))
    timedStore.recordActivity()
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(timedStore.isUnlocked(profile.id)).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(timedStore.isUnlocked(profile.id)).toBe(false)
    timedStore.dispose()
  })

  it('blocks roster access after lease expiry', async () => {
    const profile = await store.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    await store.unlockProfile(profile.id, '184629')
    await store.saveBootstrap(profile.id, {
      actor: { id: '11' },
      ministries: [], roster: [], server_cursor: 'cursor-1',
      lease: lease(profile.id, '11', profile.deviceId, '2026-09-27T23:59:59Z'),
    })

    expect(await store.isLeaseValid(profile.id)).toBe(false)
    await expect(store.readEncryptedRoster(profile.id)).rejects.toThrow('expired')
  })

  it('rejects bootstrap data for a different server actor', async () => {
    const profile = await store.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    await store.unlockProfile(profile.id, '184629')

    await expect(store.saveBootstrap(profile.id, {
      actor: { id: '12' },
      ministries: [], roster: [], server_cursor: 'cursor-1',
      lease: lease(profile.id, '12', profile.deviceId, '2026-10-12T00:00:00Z'),
    })).rejects.toThrow('actor')
  })

  it('does not extend encrypted authorization by editing the clear profile expiry', async () => {
    const profile = await store.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    await store.unlockProfile(profile.id, '184629')
    await store.saveBootstrap(profile.id, {
      actor: { id: '11' }, ministries: [], roster: [{ id: 'student-a' }], server_cursor: '1',
      lease: lease(profile.id, '11', profile.deviceId, '2026-09-27T23:59:59Z'),
    })
    await db.profiles.update(profile.id, { leaseExpiresAt: '2099-01-01T00:00:00Z' })

    expect(await store.isLeaseValid(profile.id)).toBe(false)
    await expect(store.readEncryptedRoster(profile.id)).rejects.toThrow('expired')
    await expect(store.encryptLocalPayload(profile.id, 'draft', {})).rejects.toThrow('expired')
  })

  it('invalidates cached authorization after server denial without discarding unsynchronized work', async () => {
    const profile = await store.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    await store.unlockProfile(profile.id, '184629')
    await store.saveBootstrap(profile.id, {
      actor: { id: '11' }, ministries: [{ id: 'ministry-a', name: 'Primary', version: 1 }], roster: [{ id: 'student-a' }], server_cursor: '1',
      lease: lease(profile.id, '11', profile.deviceId, '2026-10-12T00:00:00Z'),
    })
    await db.attendanceDrafts.put({
      profileId: profile.id, id: 'draft-a', encrypted: await store.encryptLocalPayload(profile.id, 'attendance-draft:draft-a', { id: 'draft-a' }), updatedAt: '2026-09-28T00:00:00Z',
    })
    await db.outboxEvents.put({
      profileId: profile.id, id: 'event-a', encrypted: await store.encryptLocalPayload(profile.id, 'outbox-event:event-a', { id: 'event-a' }), updatedAt: '2026-09-28T00:00:00Z',
    })

    await (store as LocalProfileStore & { invalidateAuthorization(profileId: string): Promise<void> }).invalidateAuthorization(profile.id)

    expect((await db.profiles.get(profile.id))?.requiresReauthentication).toBe(true)
    expect(await db.encryptedBlobs.where('profileId').equals(profile.id).count()).toBe(0)
    expect(await db.attendanceDrafts.where('profileId').equals(profile.id).count()).toBe(1)
    expect(await db.outboxEvents.where('profileId').equals(profile.id).count()).toBe(1)
  })

  it('atomically quarantines work for assignments removed by a refreshed bootstrap', async () => {
    const profile = await store.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    await store.unlockProfile(profile.id, '184629')
    await store.saveBootstrap(profile.id, {
      actor: { id: '11' },
      ministries: [
        { id: 'ministry-a', name: 'Primary', version: 1 },
        { id: 'ministry-b', name: 'Youth', version: 1 },
      ],
      roster: [
        { id: 'student-a', ministry_ids: ['ministry-a'] },
        { id: 'student-b', ministry_ids: ['ministry-b'] },
      ],
      server_cursor: '10',
      lease: lease(profile.id, '11', profile.deviceId, '2026-10-12T00:00:00Z'),
    })
    const draft = { id: 'draft-b', ministryId: 'ministry-b', entries: [] }
    const event = { id: 'event-b', entityId: draft.id, action: 'attendance.draft_created' }
    await db.attendanceDrafts.put({
      profileId: profile.id,
      id: draft.id,
      encrypted: await store.encryptLocalPayload(profile.id, `attendance-draft:${draft.id}`, draft),
      updatedAt: '2026-09-28T00:00:00Z',
    })
    await db.outboxEvents.put({
      profileId: profile.id,
      id: event.id,
      encrypted: await store.encryptLocalPayload(profile.id, `outbox-event:${event.id}`, event),
      updatedAt: '2026-09-28T00:00:00Z',
    })

    await store.saveBootstrap(profile.id, {
      actor: { id: '11' },
      ministries: [{ id: 'ministry-a', name: 'Primary', version: 2 }],
      roster: [{ id: 'student-a', ministry_ids: ['ministry-a'] }],
      server_cursor: '20',
      lease: lease(profile.id, '11', profile.deviceId, '2026-10-12T00:00:00Z'),
    })

    expect(await db.attendanceDrafts.where('profileId').equals(profile.id).count()).toBe(0)
    expect(await db.outboxEvents.where('profileId').equals(profile.id).count()).toBe(0)
    expect(await db.conflicts.where('profileId').equals(profile.id).count()).toBe(2)
    expect(await store.readEncryptedMinistries(profile.id)).toEqual([{ id: 'ministry-a', name: 'Primary', version: 2 }])
    expect(await store.readEncryptedRoster(profile.id)).toEqual([{ id: 'student-a', ministry_ids: ['ministry-a'] }])
    expect((await db.serverCursors.get(profile.id))?.cursor).toBe('20')
    const quarantinedDraft = await db.conflicts.get([profile.id, `draft-${draft.id}`])
    expect(await store.decryptLocalPayload(
      profile.id,
      `sync-conflict:draft-${draft.id}`,
      quarantinedDraft!.encrypted,
    )).toMatchObject({ reason: 'assignment_revoked', draft })
  })

  it('purges only the selected profile and its namespaced data', async () => {
    const first = await store.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    const second = await store.createProfile({ actorId: '12', churchId: lease('', '', '', '').church_id, pin: '934175' })
    await store.unlockProfile(first.id, '184629')
    await store.saveEncryptedRoster(first.id, [{ id: 'student-a' }])
    store.lockProfile(first.id)
    await store.unlockProfile(second.id, '934175')
    await store.saveBootstrap(second.id, {
      actor: { id: '12' }, ministries: [], roster: [{ id: 'student-b' }], server_cursor: '1',
      lease: lease(second.id, '12', second.deviceId, '2026-10-12T00:00:00Z'),
    })

    await store.purgeProfile(first.id)

    expect(await store.listProfiles()).toHaveLength(1)
    expect(await store.readEncryptedRoster(second.id)).toEqual([{ id: 'student-b' }])
  })

  it('locks the previous profile and requires online authentication before offline work can sync', async () => {
    const first = await store.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    const second = await store.createProfile({ actorId: '12', churchId: lease('', '', '', '').church_id, pin: '934175' })
    await store.unlockProfile(first.id, '184629')
    await store.saveBootstrap(first.id, {
      actor: { id: '11' }, ministries: [], roster: [{ id: 'student-a' }], server_cursor: '1',
      lease: lease(first.id, '11', first.deviceId, '2026-10-12T00:00:00Z'),
    })
    store.lockProfile(first.id)
    await store.unlockProfile(second.id, '934175')

    await store.switchProfile(first.id, '184629', { online: false })

    expect(store.isUnlocked(second.id)).toBe(false)
    expect(store.isUnlocked(first.id)).toBe(true)
    expect((await db.profiles.get(first.id))?.requiresReauthentication).toBe(true)
    expect(await store.readEncryptedRoster(first.id)).toEqual([{ id: 'student-a' }])
  })

  it('clears the server session when switching online and still requires the selected actor to sign in', async () => {
    const profile = await store.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    const signOut = vi.fn(async () => undefined)

    await store.switchProfile(profile.id, '184629', { online: true, signOut })

    expect(signOut).toHaveBeenCalledOnce()
    expect((await db.profiles.get(profile.id))?.requiresReauthentication).toBe(true)
  })

  it('adds increasing delay after failed PIN attempts and allows reset only after online authentication', async () => {
    const profile = await store.createProfile({ actorId: '11', churchId: lease('', '', '', '').church_id, pin: '184629' })
    await expect(store.unlockProfile(profile.id, '000000')).rejects.toThrow('incorrect')
    expect((await db.profiles.get(profile.id))?.failedAttempts).toBe(1)
    await expect(store.unlockProfile(profile.id, '184629')).rejects.toThrow('later')
    await expect(store.resetProfileAfterOnlineAuthentication(profile.id, false)).rejects.toThrow('Online authentication')
    await store.resetProfileAfterOnlineAuthentication(profile.id, true)
    expect(await db.profiles.get(profile.id)).toBeUndefined()
  })
})
