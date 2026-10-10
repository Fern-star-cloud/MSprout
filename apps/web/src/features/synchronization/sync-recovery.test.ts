import { expect, it, vi } from 'vitest'
import { SyncRecovery } from './sync-recovery'
import { ApiError } from '../../api/client'
import type { ProfileRecord, OfflineBootstrap } from '../../offline/schema'

const profile = { id: 'profile-a', actorId: '11', churchId: 'church-a', deviceId: 'device-a' } as ProfileRecord
function fixture() {
  const assertCurrent = vi.fn()
  const verify = vi.fn(async () => {})
  const bootstrap = vi.fn(async () => ({ actor: { id: '11' } }) as OfflineBootstrap)
  const store = { isUnlocked: vi.fn(() => true), saveBootstrap: vi.fn(async () => {}), invalidateAuthorization: vi.fn(async () => {}), lockProfile: vi.fn() }
  const sync = { syncProfile: vi.fn(async () => ({ pushed: 0, acknowledged: 0, conflicts: 0, rejected: 0, pulled: 0, nextCursor: '4' })) }
  return { assertCurrent, verify, bootstrap, store, sync }
}
it('refreshes only an existing unlocked profile, rechecks account and preserves the applied cursor', async () => {
  const f = fixture()
  const recovery = new SyncRecovery(f.store, f.sync, f.bootstrap)
  await recovery.continue(profile, f.verify, f.assertCurrent)
  expect(f.verify).toHaveBeenCalledTimes(2)
  expect(f.bootstrap).toHaveBeenCalledWith(profile)
  expect(f.store.saveBootstrap).toHaveBeenCalledWith(profile.id, { actor: { id: '11' } }, { preserveCursor: true })
  expect(f.sync.syncProfile).toHaveBeenCalledWith(profile.id)
})
it('coalesces repeated actions without repeating bootstrap or synchronization', async () => {
  const f = fixture()
  let finish!: () => void
  f.sync.syncProfile.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ pushed: 1, acknowledged: 1, conflicts: 0, rejected: 0, pulled: 2, nextCursor: '4' }) }))
  const recovery = new SyncRecovery(f.store, f.sync, f.bootstrap)
  const first = recovery.continue(profile, f.verify, f.assertCurrent)
  const second = recovery.continue(profile, f.verify, f.assertCurrent)
  expect(second).toBe(first)
  await vi.waitFor(() => expect(f.sync.syncProfile).toHaveBeenCalledOnce())
  finish(); await first
  expect(f.bootstrap).toHaveBeenCalledOnce()
})
it.each(['account', 'lock', 'late'])('does not continue after %s changes', async (cause) => {
  const f = fixture()
  if (cause === 'account') f.verify.mockRejectedValue(new Error('Wrong actor'))
  if (cause === 'lock') f.store.isUnlocked.mockReturnValue(false)
  if (cause === 'late') f.bootstrap.mockImplementation(async () => { f.assertCurrent.mockImplementation(() => { throw new Error('Cancelled') }); return {} as OfflineBootstrap })
  await expect(new SyncRecovery(f.store, f.sync, f.bootstrap).continue(profile, f.verify, f.assertCurrent)).rejects.toThrow()
  expect(f.store.saveBootstrap).not.toHaveBeenCalled()
  expect(f.sync.syncProfile).not.toHaveBeenCalled()
})
it('retains uncertain transport outcomes for an explicit same-profile retry', async () => {
  const f = fixture()
  f.sync.syncProfile.mockRejectedValueOnce(new TypeError('response lost'))
  const recovery = new SyncRecovery(f.store, f.sync, f.bootstrap)
  await expect(recovery.continue(profile, f.verify, f.assertCurrent)).rejects.toThrow()
  expect(f.store.invalidateAuthorization).not.toHaveBeenCalled()
  await recovery.continue(profile, f.verify, f.assertCurrent)
  expect(f.sync.syncProfile).toHaveBeenCalledTimes(2)
})
it.each([401, 403])('uses existing fail-closed invalidation after authorization denial %s', async (status) => {
  const f = fixture(); f.bootstrap.mockRejectedValue(new ApiError('denied', '', '', status))
  await expect(new SyncRecovery(f.store, f.sync, f.bootstrap).continue(profile, f.verify, f.assertCurrent)).rejects.toThrow()
  expect(f.store.invalidateAuthorization).toHaveBeenCalledWith(profile.id)
  expect(f.store.saveBootstrap).not.toHaveBeenCalled(); expect(f.sync.syncProfile).not.toHaveBeenCalled()
})
