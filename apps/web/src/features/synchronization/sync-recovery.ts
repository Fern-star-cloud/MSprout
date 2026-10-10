import { ApiError } from '../../api/client'
import { profileStore, type LocalProfileStore } from '../../offline/profile-store'
import type { OfflineBootstrap, ProfileRecord } from '../../offline/schema'
import { syncClient, type SyncClient, type SyncSummary } from '../../sync/sync-client'
import { authRequest } from '../auth/transport'

export class SyncRecovery {
  private readonly inFlight = new Map<string, Promise<SyncSummary>>()
  private readonly store: Pick<LocalProfileStore, 'isUnlocked' | 'saveBootstrap' | 'invalidateAuthorization' | 'lockProfile'>
  private readonly synchronizer: Pick<SyncClient, 'syncProfile'>
  private readonly bootstrap: (profile: ProfileRecord) => Promise<OfflineBootstrap>
  constructor(
    store: SyncRecovery['store'] = profileStore,
    synchronizer: SyncRecovery['synchronizer'] = syncClient,
    bootstrap = (profile: ProfileRecord) => authRequest<OfflineBootstrap>(`/api/offline/bootstrap?device_id=${encodeURIComponent(profile.deviceId)}`, 'GET', undefined, profile.churchId!),
  ) { this.store = store; this.synchronizer = synchronizer; this.bootstrap = bootstrap }

  continue(profile: ProfileRecord, verifyAccount: () => Promise<void>, assertCurrent: () => void): Promise<SyncSummary> {
    const existing = this.inFlight.get(profile.id)
    if (existing) return existing
    const running = this.run(profile, verifyAccount, assertCurrent).finally(() => { this.inFlight.delete(profile.id) })
    this.inFlight.set(profile.id, running)
    return running
  }

  private async run(profile: ProfileRecord, verifyAccount: () => Promise<void>, assertCurrent: () => void): Promise<SyncSummary> {
    const check = () => { assertCurrent(); if (!this.store.isUnlocked(profile.id)) throw new Error('Profile locked') }
    try {
      check()
      await verifyAccount(); check()
      const bootstrap = await this.bootstrap(profile); check()
      await verifyAccount(); check()
      // Existing saveBootstrap enforces actor/church/device/lease binding. Never
      // replace the applied cursor with bootstrap's latest server cursor.
      await this.store.saveBootstrap(profile.id, bootstrap, { preserveCursor: true }); check()
      return await this.synchronizer.syncProfile(profile.id)
    } catch (cause) {
      if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
        try { await this.store.invalidateAuthorization(profile.id) }
        catch { this.store.lockProfile(profile.id) }
      }
      throw cause
    }
  }
}
export const syncRecovery = new SyncRecovery()
