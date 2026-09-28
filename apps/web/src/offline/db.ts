import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  EncryptedBlobRecord,
  EncryptedEntityRecord,
  MetadataRecord,
  ProfileRecord,
  ServerCursorRecord,
} from './schema'

export class OfflineDatabase extends Dexie {
  profiles!: EntityTable<ProfileRecord, 'id'>
  encryptedBlobs!: Table<EncryptedBlobRecord, [string, string]>
  attendanceDrafts!: Table<EncryptedEntityRecord, [string, string]>
  outboxEvents!: Table<EncryptedEntityRecord, [string, string]>
  serverCursors!: EntityTable<ServerCursorRecord, 'profileId'>
  conflicts!: Table<EncryptedEntityRecord, [string, string]>
  metadata!: Table<MetadataRecord, [string, string]>

  constructor(name = 'ministry-sprout-offline') {
    super(name)
    this.version(1).stores({
      profiles: '&id, actorId, churchId, deviceId, createdAt',
      encryptedBlobs: '&[profileId+key], profileId',
      attendanceDrafts: '&[profileId+id], profileId',
      outboxEvents: '&[profileId+id], profileId',
      serverCursors: '&profileId',
      conflicts: '&[profileId+id], profileId',
      metadata: '&[profileId+key], profileId',
    })
  }
}

export function createOfflineDatabase(name?: string): OfflineDatabase {
  return new OfflineDatabase(name)
}

export const offlineDatabase = createOfflineDatabase()
