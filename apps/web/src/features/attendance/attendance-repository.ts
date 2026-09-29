import type { EncryptedEnvelope } from '../../offline/schema'
import { offlineDatabase, type OfflineDatabase } from '../../offline/db'
import { profileStore } from '../../offline/profile-store'
import type {
  AttendanceDraft,
  AttendanceEventAction,
  AttendanceState,
  CreateAttendanceDraftInput,
  LocalAttendanceEvent,
} from './domain'

export interface AttendanceCrypto {
  encrypt(profileId: string, purpose: string, value: unknown): Promise<EncryptedEnvelope>
  decrypt<T>(profileId: string, purpose: string, envelope: EncryptedEnvelope): Promise<T>
}

interface RepositoryOptions {
  now?: () => Date
  id?: () => string
}

const profileCrypto: AttendanceCrypto = {
  encrypt: (profileId, purpose, value) => profileStore.encryptLocalPayload(profileId, purpose, value),
  decrypt: (profileId, purpose, envelope) => profileStore.decryptLocalPayload(profileId, purpose, envelope),
}

function assertDate(value: string): void {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Attendance date is invalid.')
  }
}

async function stableDraftId(churchId: string, ministryId: string, attendanceDate: string): Promise<string> {
  const input = new TextEncoder().encode(`ministrysprout:attendance:${churchId}:${ministryId}:${attendanceDate}`)
  const bytes = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input)).slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export class AttendanceRepository {
  private readonly now: () => Date
  private readonly id: () => string
  private readonly db: OfflineDatabase
  private readonly codec: AttendanceCrypto

  constructor(
    db: OfflineDatabase = offlineDatabase,
    codec: AttendanceCrypto = profileCrypto,
    options: RepositoryOptions = {},
  ) {
    this.db = db
    this.codec = codec
    this.now = options.now ?? (() => new Date())
    this.id = options.id ?? (() => globalThis.crypto.randomUUID())
  }

  async createDraft(input: CreateAttendanceDraftInput): Promise<AttendanceDraft> {
    assertDate(input.attendanceDate)
    const studentIds = input.students.map((student) => student.id)
    if (new Set(studentIds).size !== studentIds.length) throw new Error('The attendance roster contains a duplicate student.')
    const now = this.now().toISOString()
    const draft: AttendanceDraft = {
      id: await stableDraftId(input.churchId, input.ministryId, input.attendanceDate),
      profileId: input.profileId,
      churchId: input.churchId,
      ministryId: input.ministryId,
      ministryName: input.ministryName,
      attendanceDate: input.attendanceDate,
      status: 'draft',
      version: 1,
      entries: input.students.map((student) => ({
        studentId: student.id,
        displayName: student.displayName,
        gender: student.gender,
        state: 'unmarked',
      })),
      guests: [],
      updatedAt: now,
    }
    const event = this.event(draft, 'attendance.draft_created', 0, {
      ministry_id: draft.ministryId,
      attendance_date: draft.attendanceDate,
      student_ids: studentIds,
    })
    const encryptedDraft = await this.codec.encrypt(input.profileId, `attendance-draft:${draft.id}`, draft)
    const encryptedEvent = await this.codec.encrypt(input.profileId, `outbox-event:${event.id}`, event)

    let created = false
    await this.db.transaction('rw', this.db.attendanceDrafts, this.db.outboxEvents, async () => {
      if (await this.db.attendanceDrafts.get([input.profileId, draft.id])) return
      await this.db.attendanceDrafts.add({ profileId: input.profileId, id: draft.id, encrypted: encryptedDraft, updatedAt: now })
      await this.db.outboxEvents.add({ profileId: input.profileId, id: event.id, encrypted: encryptedEvent, updatedAt: now })
      created = true
    })

    if (created) return draft
    const existing = await this.db.attendanceDrafts.get([input.profileId, draft.id])
    if (!existing) throw new Error('Attendance draft could not be loaded.')
    return this.codec.decrypt<AttendanceDraft>(input.profileId, `attendance-draft:${draft.id}`, existing.encrypted)
  }

  async findDraft(profileId: string, ministryId: string, attendanceDate: string): Promise<AttendanceDraft | null> {
    assertDate(attendanceDate)
    const records = await this.db.attendanceDrafts.where('profileId').equals(profileId).toArray()
    for (const record of records) {
      const draft = await this.codec.decrypt<AttendanceDraft>(profileId, `attendance-draft:${record.id}`, record.encrypted)
      if (draft.ministryId === ministryId && draft.attendanceDate === attendanceDate) return draft
    }
    return null
  }

  async markStudent(profileId: string, draftId: string, studentId: string, state: AttendanceState): Promise<AttendanceDraft> {
    if (state === 'unmarked') throw new Error('Use Present or Absent when marking attendance.')
    return this.mutate(profileId, draftId, 'attendance.student_marked', (draft) => {
      const entry = draft.entries.find((candidate) => candidate.studentId === studentId)
      if (!entry) throw new Error('Student is not part of this attendance roster.')
      entry.state = state
      return { student_id: studentId, state }
    })
  }

  async bulkMark(profileId: string, draftId: string, state: AttendanceState, only?: AttendanceState): Promise<AttendanceDraft> {
    if (state === 'unmarked') throw new Error('Use Present or Absent when marking attendance.')
    return this.mutate(profileId, draftId, 'attendance.bulk_marked', (draft) => {
      const studentIds: string[] = []
      for (const entry of draft.entries) {
        if (only === undefined || entry.state === only) {
          entry.state = state
          studentIds.push(entry.studentId)
        }
      }
      return { state, student_ids: studentIds }
    })
  }

  async finalizeDraft(profileId: string, draftId: string): Promise<AttendanceDraft> {
    return this.mutate(profileId, draftId, 'attendance.finalized', (draft) => {
      if (draft.entries.some((entry) => entry.state === 'unmarked')) {
        throw new Error('Every unmarked regular roster entry must be resolved before finalization.')
      }
      draft.status = 'finalized_pending'
      return {}
    })
  }

  async addGuest(
    profileId: string,
    draftId: string,
    displayName: string,
    gender: AttendanceDraft['entries'][number]['gender'] = 'unspecified',
  ): Promise<AttendanceDraft> {
    const normalized = displayName.replace(/[\s\p{Z}]+/gu, ' ').trim()
    if (!normalized || normalized.length > 120) throw new Error('Guest display name must be between 1 and 120 characters.')
    if (!['male', 'female', 'unspecified'].includes(gender)) throw new Error('Guest gender is invalid.')

    return this.mutate(profileId, draftId, 'attendance.guest_added', (draft, eventId) => {
      draft.guests ??= []
      draft.guests.push({ id: eventId, displayName: normalized, gender, state: 'present', status: 'pending' })
      return { display_name: normalized, gender }
    })
  }

  async countPending(profileId: string): Promise<number> {
    return this.db.outboxEvents.where('profileId').equals(profileId).count()
  }

  async listEvents(profileId: string): Promise<LocalAttendanceEvent[]> {
    const records = await this.db.outboxEvents.where('profileId').equals(profileId).toArray()
    const events = await Promise.all(records.map((record) =>
      this.codec.decrypt<LocalAttendanceEvent>(profileId, `outbox-event:${record.id}`, record.encrypted),
    ))
    return events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id))
  }

  private async mutate(
    profileId: string,
    draftId: string,
    action: AttendanceEventAction,
    change: (draft: AttendanceDraft, eventId: string) => Record<string, unknown>,
  ): Promise<AttendanceDraft> {
    const stored = await this.db.attendanceDrafts.get([profileId, draftId])
    if (!stored) throw new Error('Attendance draft not found.')
    const draft = await this.codec.decrypt<AttendanceDraft>(profileId, `attendance-draft:${draftId}`, stored.encrypted)
    draft.guests ??= []
    if (draft.status !== 'draft') throw new Error('This attendance draft is no longer editable.')
    const baseVersion = draft.version
    const eventId = this.id()
    const payload = change(draft, eventId)
    draft.version += 1
    draft.updatedAt = this.now().toISOString()
    const event = this.event(draft, action, baseVersion, payload, eventId)
    const encryptedDraft = await this.codec.encrypt(profileId, `attendance-draft:${draft.id}`, draft)
    const encryptedEvent = await this.codec.encrypt(profileId, `outbox-event:${event.id}`, event)

    await this.db.transaction('rw', this.db.attendanceDrafts, this.db.outboxEvents, async () => {
      const current = await this.db.attendanceDrafts.get([profileId, draftId])
      if (!current || current.updatedAt !== stored.updatedAt || current.encrypted.ciphertext !== stored.encrypted.ciphertext) {
        throw new Error('Attendance draft changed on this device. Reload it before continuing.')
      }
      await this.db.attendanceDrafts.put({ profileId, id: draft.id, encrypted: encryptedDraft, updatedAt: draft.updatedAt })
      await this.db.outboxEvents.add({ profileId, id: event.id, encrypted: encryptedEvent, updatedAt: draft.updatedAt })
    })

    return draft
  }

  private event(
    draft: AttendanceDraft,
    action: AttendanceEventAction,
    baseVersion: number,
    payload: Record<string, unknown>,
    id = this.id(),
  ): LocalAttendanceEvent {
    return {
      id,
      profileId: draft.profileId,
      entityId: draft.id,
      action,
      baseVersion,
      occurredAt: this.now().toISOString(),
      payload,
    }
  }
}

export const attendanceRepository = new AttendanceRepository()
