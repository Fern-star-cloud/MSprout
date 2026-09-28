import type { OfflineLease, ProfileRecord } from './schema'

export function isLeaseValid(profile: Pick<ProfileRecord, 'leaseExpiresAt' | 'requiresReauthentication'>, now = new Date()): boolean {
  if (!profile.leaseExpiresAt || profile.requiresReauthentication) return false
  const expiry = Date.parse(profile.leaseExpiresAt)
  return Number.isFinite(expiry) && expiry > now.getTime()
}

export function assertLeaseMatchesProfile(profile: ProfileRecord, lease: OfflineLease): void {
  if (lease.profile_id !== undefined && lease.profile_id !== profile.id) throw new Error('Offline lease profile mismatch.')
  if (lease.actor_id !== profile.actorId) throw new Error('Offline lease actor mismatch.')
  if (profile.churchId !== null && lease.church_id !== profile.churchId) throw new Error('Offline lease church mismatch.')
  if (lease.device_id !== profile.deviceId) throw new Error('Offline lease device mismatch.')
  if (!/^[a-f0-9]{64}$/i.test(lease.signature) || !Number.isFinite(Date.parse(lease.expires_at))) {
    throw new Error('Offline lease is invalid.')
  }
}
