import { createRoot } from 'react-dom/client'
import { createOfflineDatabase } from '../../src/offline/db'
import { LocalProfileStore } from '../../src/offline/profile-store'
import { DeviceProfilesScreen } from '../../src/features/device-profiles/DeviceProfilesScreen'
import { SyncClient } from '../../src/sync/sync-client'
import '../../src/styles/tokens.css'
import '../../src/styles/global.css'
import '../../src/App.css'
import '../../src/styles/foundations.css'

const db = createOfflineDatabase('ui03-isolated-profiles')
const store = new LocalProfileStore(db)
const synchronizer = new SyncClient(db, {
  isUnlocked: id => store.isUnlocked(id),
  captureSyncAuthorization: id => store.captureSyncAuthorization(id),
  authorizationRenewed: async id => { await store.readEncryptedAuthorization(id) },
  encrypt: (id, purpose, value) => store.encryptLocalPayload(id, purpose, value),
  decrypt: (id, purpose, envelope) => store.decryptLocalPayload(id, purpose, envelope),
})

async function start() {
  if (!await db.profiles.count()) {
    for (const [index, actorId] of ['11', '22'].entries()) {
      const churchId = `00000000-0000-4000-8000-00000000001${index}`
      const profile = await store.createProfile({ actorId, churchId, pin: index ? '295730' : '184629' })
      await store.unlockProfile(profile.id, index ? '295730' : '184629')
      await store.saveBootstrap(profile.id, {
        actor: { id: actorId }, ministries: [], roster: [{ display_name: `Protected Student ${actorId}` }], server_cursor: String(765430 + index),
        lease: { actor_id: actorId, church_id: churchId, device_id: profile.deviceId, membership_id: '00000000-0000-4000-8000-000000000040', issued_at: '2026-10-01T00:00:00Z', expires_at: '2099-10-01T00:00:00Z', signature: 'a'.repeat(64) },
      })
      await db.profiles.update(profile.id, { syncNeedsPull: false })
      store.lockProfile(profile.id)
    }
  }
  createRoot(document.getElementById('root')!).render(<main className="app-main"><h1>MinistrySprout</h1><DeviceProfilesScreen store={store} synchronizer={synchronizer} pendingCount={id => db.outboxEvents.where('profileId').equals(id).count()} /></main>)
}
void start().catch(error => { document.getElementById('root')!.textContent = `Synthetic fixture setup failed: ${error instanceof Error ? error.message : 'unknown failure'}` })
