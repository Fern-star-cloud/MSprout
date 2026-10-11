import { offlineDatabase } from '../../offline/db'
import { profileStore } from '../../offline/profile-store'

export async function pendingLocalAttendanceCount(churchId: string, actorId: number): Promise<number | null> {
  const profile = await profileStore.activeProfile()
  if (!profile || profile.churchId !== churchId) return null
  const authorization = profileStore.captureSyncAuthorization(profile.id)
  const bound = await profileStore.readEncryptedAuthorization<{ actor: { id: string }; lease: { church_id: string } }>(profile.id)
  if (bound.actor.id !== String(actorId) || bound.lease.church_id !== churchId) return null
  const count = await offlineDatabase.outboxEvents.where('profileId').equals(profile.id).count()
  await authorization.assertCurrent()
  return count
}
