import { offlineDatabase } from '../../offline/db'
import { profileStore } from '../../offline/profile-store'

export async function pendingLocalAttendanceCount(churchId: string): Promise<number> {
  const profile = await profileStore.activeProfile()
  if (!profile || profile.churchId !== churchId) return 0
  return offlineDatabase.outboxEvents.where('profileId').equals(profile.id).count()
}
