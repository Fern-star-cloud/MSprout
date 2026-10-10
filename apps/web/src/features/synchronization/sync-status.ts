import { offlineDatabase, type OfflineDatabase } from '../../offline/db'
import { profileStore, type LocalProfileStore } from '../../offline/profile-store'
import type { AttendanceDraft } from '../attendance/domain'

export interface SyncStatus {
  pending: number | null
  quarantined: number | null
  reviews: number | null
  downloads: 'unknown' | 'incomplete' | 'complete'
}
export const unknownSyncStatus: SyncStatus = { pending: null, quarantined: null, reviews: null, downloads: 'unknown' }

// A read-only projection of existing evidence, never an authorization source.
export async function readSyncStatus(
  profileId: string,
  db: OfflineDatabase = offlineDatabase,
  store: Pick<LocalProfileStore, 'isUnlocked' | 'isLeaseValid'> & Partial<Pick<LocalProfileStore, 'decryptLocalPayload'>> = profileStore,
): Promise<SyncStatus> {
  try {
    if (!store.isUnlocked(profileId) || !await store.isLeaseValid(profileId)) return unknownSyncStatus
    const snapshot = await db.transaction('r', db.profiles, db.outboxEvents, db.conflicts, db.serverCursors, db.attendanceDrafts, async () => {
      const [profile, cursor, pending, quarantined, drafts] = await Promise.all([
        db.profiles.get(profileId), db.serverCursors.get(profileId),
        db.outboxEvents.where('profileId').equals(profileId).count(),
        db.conflicts.where('profileId').equals(profileId).count(),
        db.attendanceDrafts.where('profileId').equals(profileId).toArray(),
      ])
      if (!profile) return null
      return { drafts, pending, quarantined, downloads: profile.syncNeedsPull === true ? 'incomplete' as const
        : profile.syncNeedsPull === false && cursor ? 'complete' as const : 'unknown' as const }
    })
    if (!snapshot) return unknownSyncStatus
    const { drafts, ...status } = snapshot
    // Decrypt outside the IndexedDB transaction using the existing lease-bound
    // accessor. A settled upload can still download a needs-review session.
    let reviews: number | null = drafts.length ? null : 0
    if (drafts.length && store.decryptLocalPayload) {
      const values = await Promise.all(drafts.map(draft => store.decryptLocalPayload!<AttendanceDraft>(profileId, `attendance-draft:${draft.id}`, draft.encrypted)))
      if (values.some(draft => !draft || !['draft', 'finalized_pending', 'finalized', 'needs_review', 'revised'].includes(draft.status))) return unknownSyncStatus
      reviews = values.filter(draft => draft.status === 'needs_review').length
    }
    return store.isUnlocked(profileId) && await store.isLeaseValid(profileId) ? { ...status, reviews } : unknownSyncStatus
  } catch { return unknownSyncStatus }
}

export function syncHeadline(status: SyncStatus): string {
  if (status.pending === null) return 'Synchronization status unknown'
  if (status.pending > 0) return 'Saved locally — pending upload'
  if (status.downloads === 'incomplete') return 'Downloads incomplete'
  if (status.downloads === 'unknown') return 'Synchronization status unknown'
  if ((status.quarantined ?? 0) > 0 || (status.reviews ?? 0) > 0) return 'Transfers complete — review remains'
  if (status.quarantined === null || status.reviews === null) return 'Synchronization status unknown'
  return 'Synchronization complete'
}
