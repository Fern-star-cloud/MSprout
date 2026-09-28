export const OFFLINE_SCHEMA_VERSION = 1
export const PBKDF2_ITERATIONS = 600_000
export const PROFILE_IDLE_TIMEOUT_MS = 5 * 60 * 1000

export interface EncryptedEnvelope {
  algorithm: 'AES-256-GCM'
  iv: string
  ciphertext: string
  schemaVersion: number
}

export interface ProfileKeyMaterial {
  salt: string
  iterations: number
  wrappedDataKey: EncryptedEnvelope
}

export interface ProfileRecord extends ProfileKeyMaterial {
  id: string
  actorId: string
  churchId: string | null
  deviceId: string
  createdAt: string
  failedAttempts: number
  retryAfter: string | null
  leaseExpiresAt: string | null
  leaseSignature: string | null
  requiresReauthentication: boolean
}

export interface EncryptedBlobRecord {
  profileId: string
  key: string
  encrypted: EncryptedEnvelope
  updatedAt: string
}

export interface EncryptedEntityRecord {
  profileId: string
  id: string
  encrypted: EncryptedEnvelope
  updatedAt: string
}

export interface ServerCursorRecord {
  profileId: string
  cursor: string
  updatedAt: string
}

export interface MetadataRecord {
  profileId: string
  key: string
  value: string
}

export interface OfflineLease {
  profile_id?: string
  actor_id: string
  church_id: string
  membership_id: string
  device_id: string
  issued_at: string
  expires_at: string
  signature: string
}

export interface OfflineBootstrap {
  actor: { id: string }
  ministries: Array<{ id: string; name: string; version: number }>
  roster: Array<Record<string, unknown>>
  lease: OfflineLease
  server_cursor: string
}
