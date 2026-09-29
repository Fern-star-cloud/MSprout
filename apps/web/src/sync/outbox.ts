import type { EncryptedEnvelope } from '../offline/schema'
import type { OfflineDatabase } from '../offline/db'
import type { LocalAttendanceEvent } from '../features/attendance/domain'

export interface OutboxCodec {
  encrypt(profileId: string, purpose: string, value: unknown): Promise<EncryptedEnvelope>
  decrypt<T>(profileId: string, purpose: string, envelope: EncryptedEnvelope): Promise<T>
}

export interface SyncEventResult {
  client_event_id: string
  status: 'accepted' | 'duplicate' | 'conflict' | 'rejected'
  original_status?: 'accepted' | 'conflict' | 'rejected'
  reason?: string
  record_id?: string
  version?: number
}

export class ProfileOutbox {
  private readonly db: OfflineDatabase
  private readonly codec: OutboxCodec

  constructor(db: OfflineDatabase, codec: OutboxCodec) {
    this.db = db
    this.codec = codec
  }

  async list(profileId: string): Promise<LocalAttendanceEvent[]> {
    const records = await this.db.outboxEvents.where('profileId').equals(profileId).toArray()
    const events = await Promise.all(records.map((record) =>
      this.codec.decrypt<LocalAttendanceEvent>(profileId, `outbox-event:${record.id}`, record.encrypted),
    ))
    return events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id))
  }

  async settle(profileId: string, results: SyncEventResult[], now: string): Promise<{ acknowledged: number; conflicts: number; rejected: number }> {
    const resultIds = new Set(results.map(result => result.client_event_id))
    if (resultIds.size !== results.length) throw new Error('The synchronization response contains duplicate event results.')
    const stored = await this.db.outboxEvents.where('profileId').equals(profileId).toArray()
    const byId = new Map(stored.map(record => [record.id, record]))
    const quarantined: Array<{ profileId: string; id: string; encrypted: EncryptedEnvelope; updatedAt: string }> = []
    const deleted: string[] = []
    let acknowledged = 0
    let conflicts = 0
    let rejected = 0

    for (const result of results) {
      const record = byId.get(result.client_event_id)
      if (!record) throw new Error('The synchronization response references an unknown local event.')
      if (result.status === 'duplicate' && result.original_status !== 'accepted') {
        throw new Error('A duplicate acknowledgement must identify the accepted original result.')
      }
      const effective = result.status === 'duplicate' ? result.original_status : result.status
      if (effective === 'accepted') {
        acknowledged += 1
      } else {
        if (!result.reason) throw new Error('A quarantined synchronization event requires a safe reason.')
        const event = await this.codec.decrypt<LocalAttendanceEvent>(profileId, `outbox-event:${record.id}`, record.encrypted)
        const id = record.id
        quarantined.push({
          profileId,
          id,
          encrypted: await this.codec.encrypt(profileId, `sync-conflict:${id}`, {
            event,
            status: effective,
            reason: result.reason,
            serverVersion: result.version ?? null,
            quarantinedAt: now,
          }),
          updatedAt: now,
        })
        if (effective === 'conflict') conflicts += 1
        else rejected += 1
      }
      deleted.push(record.id)
    }

    await this.db.transaction('rw', this.db.outboxEvents, this.db.conflicts, async () => {
      if (quarantined.length > 0) await this.db.conflicts.bulkPut(quarantined)
      await this.db.outboxEvents.bulkDelete(deleted.map(id => [profileId, id]))
    })

    return { acknowledged, conflicts, rejected }
  }
}
