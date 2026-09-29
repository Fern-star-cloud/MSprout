import { profileStore } from '../offline/profile-store'
import { syncClient } from './sync-client'

interface ActiveProfileSource {
  activeProfile(): Promise<{ id: string } | null>
}

interface ProfileSynchronizer {
  syncProfile(profileId: string): Promise<unknown>
}

export function installReconnectSynchronization(
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'> = globalThis,
  store: ActiveProfileSource = profileStore,
  synchronizer: ProfileSynchronizer = syncClient,
): () => void {
  let running = false
  const synchronize = () => {
    if (running) return
    running = true
    void store.activeProfile()
      .then(profile => profile ? synchronizer.syncProfile(profile.id) : undefined)
      .then(result => {
        if (result !== undefined) target.dispatchEvent(new Event('ministrysprout:sync-complete'))
      })
      .catch(() => target.dispatchEvent(new Event('ministrysprout:sync-authorization-invalid')))
      .finally(() => { running = false })
  }
  target.addEventListener('online', synchronize)

  return () => target.removeEventListener('online', synchronize)
}
