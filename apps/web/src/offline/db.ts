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

  // All domain writes share the profile table with removal. IndexedDB serializes
  // these transactions across connections, including writes prepared by crypto
  // before removal commits. Deleted profiles must never acquire orphaned work.
  async writeForProfile<T>(profileId: string, tables: Table[], write: () => Promise<T>): Promise<T> {
    return this.transaction('rw', [this.profiles, ...tables], async () => {
      if (!await this.profiles.get(profileId)) throw new Error('This device profile is no longer available. No changes were saved.')
      return write()
    })
  }
}

export function createOfflineDatabase(name?: string): OfflineDatabase {
  return new OfflineDatabase(name)
}

export const offlineDatabase = createOfflineDatabase()
