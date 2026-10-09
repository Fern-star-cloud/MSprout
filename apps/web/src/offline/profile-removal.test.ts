import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOfflineDatabase, type OfflineDatabase } from './db'
import { LocalProfileStore } from './profile-store'
import { AttendanceRepository } from '../features/attendance/attendance-repository'

describe('preservation-first profile removal', () => {
  let db: OfflineDatabase
  let store: LocalProfileStore
  const keys = new Map<string, CryptoKey>()
  const churchId = '00000000-0000-4000-8000-000000000010'
  beforeEach(() => {
    db = createOfflineDatabase(`removal-${crypto.randomUUID()}`)
    store = new LocalProfileStore(db, {
      createKeyMaterial: async id => {
        keys.set(id, await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']))
        return { salt: 'synthetic', iterations: 600_000, wrappedDataKey: { algorithm: 'AES-256-GCM', iv: 'synthetic', ciphertext: 'synthetic', schemaVersion: 1 } }
      },
      unwrapKey: async id => keys.get(id)!,
    })
  })
  afterEach(async () => { store.dispose(); await db.delete(); vi.restoreAllMocks() })
  const snapshot = () => Promise.all(db.tables.map(table => table.toArray()))
  async function prepared(actorId = '11', church = churchId) {
    const profile = await store.createProfile({ actorId, churchId: church, pin: '184629' })
    await store.unlockProfile(profile.id, '184629')
    await store.saveBootstrap(profile.id, { actor: { id: actorId }, ministries: [], roster: [], server_cursor: '0', lease: {
      actor_id: actorId, church_id: church, device_id: profile.deviceId,
      membership_id: '00000000-0000-4000-8000-000000000020', issued_at: '2026-01-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', signature: 'a'.repeat(64),
    } })
    await db.profiles.update(profile.id, { syncNeedsPull: false })
    return profile
  }
  const confirm = (id: string) => ({ confirmedProfileId: id })

  it.each(['attendanceDrafts', 'outboxEvents', 'conflicts'] as const)('refuses %s with zero deletions and retains the key', async table => {
    const profile = await prepared()
    await db[table].put({ profileId: profile.id, id: 'work', encrypted: profile.wrappedDataKey, updatedAt: 'synthetic' })
    const before = await snapshot()
    await expect(store.purgeProfile(profile.id, confirm(profile.id))).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
    expect(store.isUnlocked(profile.id)).toBe(true)
  })

  it.each(['locked', 'unverified', 'incomplete', 'expired', 'reauthentication', 'unknown metadata', 'unknown blob', 'missing cursor', 'corrupt cache'])('refuses %s with zero deletions', async state => {
    const profile = await prepared()
    if (state === 'locked') store.lockProfile(profile.id)
    if (state === 'unverified') await db.profiles.update(profile.id, { syncNeedsPull: undefined })
    if (state === 'incomplete') await db.profiles.update(profile.id, { syncNeedsPull: true })
    if (state === 'expired') await db.profiles.update(profile.id, { leaseExpiresAt: '2020-01-01T00:00:00Z' })
    if (state === 'reauthentication') await db.profiles.update(profile.id, { requiresReauthentication: true })
    if (state === 'unknown metadata') await db.metadata.put({ profileId: profile.id, key: 'future-work', value: 'unknown' })
    if (state === 'unknown blob') await db.encryptedBlobs.put({ profileId: profile.id, key: 'future-work', encrypted: profile.wrappedDataKey, updatedAt: 'synthetic' })
    if (state === 'missing cursor') await db.serverCursors.delete(profile.id)
    if (state === 'corrupt cache') await db.encryptedBlobs.update([profile.id, 'roster'], { encrypted: profile.wrappedDataKey })
    const before = await snapshot()
    await expect(store.purgeProfile(profile.id, confirm(profile.id))).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })

  it('requires confirmation of the exact selected profile and disallows the legacy reset shortcut', async () => {
    const profile = await prepared()
    const before = await snapshot()
    await expect(store.purgeProfile(profile.id)).rejects.toThrow()
    await expect(store.purgeProfile(profile.id, confirm('another-profile'))).rejects.toThrow()
    await expect(store.resetProfileAfterOnlineAuthentication(profile.id, true)).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })

  it('permits confirmed removal of a genuinely empty never-prepared profile after PIN unlock', async () => {
    const profile = await store.createProfile({ actorId: '11', churchId, pin: '184629' })
    await store.unlockProfile(profile.id, '184629')
    expect(await store.assessRemoval(profile.id)).toEqual({ status: 'ready' })
    await store.purgeProfile(profile.id, confirm(profile.id))
    expect((await snapshot()).every(rows => rows.length === 0)).toBe(true)
  })

  it('removes only a verified empty profile while preserving other profiles and churches byte-for-byte', async () => {
    const other = await prepared('22', '00000000-0000-4000-8000-000000000011')
    await db.outboxEvents.put({ profileId: other.id, id: 'other-work', encrypted: other.wrappedDataKey, updatedAt: 'synthetic' })
    const sameChurch = await prepared('33')
    const before = await snapshot()
    const profile = await prepared()
    await store.purgeProfile(profile.id, confirm(profile.id))
    expect(await snapshot()).toEqual(before)
    expect(store.isUnlocked(profile.id)).toBe(false)
    await store.unlockProfile(sameChurch.id, '184629')
    expect(await store.readEncryptedRoster(sameChurch.id)).toEqual([])
  })

  it('rechecks after a safe preview when another connection commits local work', async () => {
    const profile = await prepared()
    expect(await store.assessRemoval(profile.id)).toEqual({ status: 'ready' })
    const second = createOfflineDatabase(db.name)
    try {
      await second.outboxEvents.put({ profileId: profile.id, id: 'concurrent', encrypted: profile.wrappedDataKey, updatedAt: 'synthetic' })
      const before = await snapshot()
      await expect(store.purgeProfile(profile.id, confirm(profile.id))).rejects.toThrow()
      expect(await snapshot()).toEqual(before)
    } finally { second.close() }
  })

  it('rejects a write prepared before removal instead of resurrecting orphaned drafts or outbox data', async () => {
    const profile = await prepared()
    const second = createOfflineDatabase(db.name)
    let release!: () => void
    let started!: () => void
    const captured = new Promise<void>(resolve => { started = resolve })
    const pause = new Promise<void>(resolve => { release = resolve })
    let encrypted = 0
    const repository = new AttendanceRepository(second, {
      encrypt: async () => { if (++encrypted === 2) { started(); await pause }; return profile.wrappedDataKey },
      decrypt: async <T,>() => ({} as T),
    })
    const writing = repository.createDraft({ profileId: profile.id, churchId, ministryId: 'ministry-a', ministryName: 'Synthetic', attendanceDate: '2026-10-10', students: [] })
    const result = writing.then(() => 'saved', () => 'preserved failure')
    try {
      await captured
      await store.purgeProfile(profile.id, confirm(profile.id))
      release()
      expect(await result).toBe('preserved failure')
      expect((await snapshot()).every(rows => rows.length === 0)).toBe(true)
    } finally { release(); await result; second.close() }
  })

  it('rechecks all stores inside the deletion transaction after concurrent work arrives during verification', async () => {
    const profile = await prepared()
    const second = createOfflineDatabase(db.name)
    const decrypt = crypto.subtle.decrypt.bind(crypto.subtle)
    let release!: () => void
    let started!: () => void
    const captured = new Promise<void>(resolve => { started = resolve })
    const pause = new Promise<void>(resolve => { release = resolve })
    vi.spyOn(crypto.subtle, 'decrypt').mockImplementationOnce(async (...args) => {
      const value = await decrypt(...args)
      started()
      await pause
      return value
    })
    const removing = store.purgeProfile(profile.id, confirm(profile.id))
    const outcome = removing.then(() => 'removed', () => 'preserved')
    try {
      await captured
      await second.metadata.put({ profileId: profile.id, key: 'unverified-work', value: 'synthetic' })
      const before = await snapshot()
      release()
      expect(await outcome).toBe('preserved')
      expect(await snapshot()).toEqual(before)
      expect(store.isUnlocked(profile.id)).toBe(true)
    } finally { release(); await outcome; second.close() }
  })

  it('rolls every deletion back on a storage failure and preserves the active key', async () => {
    const profile = await prepared()
    const before = await snapshot()
    vi.spyOn(db.serverCursors, 'delete').mockRejectedValueOnce(new Error('synthetic storage failure'))
    await expect(store.purgeProfile(profile.id, confirm(profile.id))).rejects.toThrow('synthetic storage failure')
    expect(await snapshot()).toEqual(before)
    expect(store.isUnlocked(profile.id)).toBe(true)
  })

  it('treats an unavailable safety read as unknown and performs no mutation', async () => {
    const profile = await prepared()
    const before = await snapshot()
    vi.spyOn(db.profiles, 'get').mockRejectedValueOnce(new Error('synthetic read failure'))
    expect(await store.assessRemoval(profile.id)).toEqual({ status: 'unknown' })
    expect(await snapshot()).toEqual(before)
  })

  it('clears another connection’s active key when the safely removed profile disappears', async () => {
    const profile = await prepared()
    const second = createOfflineDatabase(db.name)
    const otherStore = new LocalProfileStore(second, { unwrapKey: async id => keys.get(id)! })
    try {
      await otherStore.unlockProfile(profile.id, '184629')
      const locked = vi.fn()
      otherStore.onLock(locked)
      await store.purgeProfile(profile.id, confirm(profile.id))
      await vi.waitFor(() => expect(otherStore.isUnlocked(profile.id)).toBe(false))
      expect(locked).toHaveBeenCalledWith(profile.id, 'manual')
      await expect(otherStore.readEncryptedRoster(profile.id)).rejects.toThrow('locked')
    } finally { otherStore.dispose(); second.close() }
  })
})
