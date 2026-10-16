import type { OfflineLease, ProfileRecord } from '../offline/schema'
import { assertLeaseMatchesProfile } from '../offline/lease'
import type { AttendanceState } from '../features/attendance/domain'

export class SyncDownloadError extends Error {
  constructor(detail = 'The synchronization page contains invalid or unsupported data.') {
    super(`Downloading could not be completed safely. ${detail}`)
    this.name = 'SyncDownloadError'
  }
}

interface AttendanceRecord { id: string; student_id: string; state: AttendanceState; version: number }
interface Guest {
  id: string; display_name: string; gender: 'male' | 'female' | 'unspecified'; state: 'present'
  status: 'pending' | 'promoted' | 'linked' | 'merged'
}
interface AttendancePayload {
  id: string; ministry_id: string; attendance_date: string; version: number
  status: 'draft' | 'finalized_pending' | 'finalized' | 'needs_review' | 'revised'
  records: AttendanceRecord[]; guests: Guest[]
}
type Change = { sequence: string; entity_id: string; version: number; ministry_id: string } & (
  { entity_type: 'attendance_session'; action: 'upsert'; payload: AttendancePayload }
  | { entity_type: 'ministry_assignment'; action: 'tombstone'; payload: { ministry_id: string } }
)
export interface PullPage { changes: Change[]; page: { next_cursor: string; has_more: boolean }; lease: OfflineLease }

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)
const version = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 1
const cursor = (value: unknown): value is string => typeof value === 'string' && /^\d+$/.test(value)
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const timestamp = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
  && date(value.slice(0, 10)) && Number.isFinite(Date.parse(value))
const optional = (row: Record<string, unknown>, key: string, valid: (value: unknown) => boolean) => !Object.hasOwn(row, key) || valid(row[key])
const nullableUuid = (value: unknown) => value === null || uuid(value)
const nullableTime = (value: unknown) => value === null || timestamp(value)
const oneOf = (value: unknown, values: readonly string[]) => typeof value === 'string' && values.includes(value)
const requireValid: (condition: unknown, detail?: string) => asserts condition = (condition, detail) => { if (!condition) throw new SyncDownloadError(detail) }

function attendance(payload: Record<string, unknown>, change: Record<string, unknown>, profile: ProfileRecord) {
  requireValid(payload.id === change.entity_id && payload.ministry_id === change.ministry_id
    && payload.version === change.version && date(payload.attendance_date)
    && oneOf(payload.status, ['draft', 'finalized_pending', 'finalized', 'needs_review', 'revised'])
    && Array.isArray(payload.records) && Array.isArray(payload.guests))
  requireValid(optional(payload, 'church_id', value => value === profile.churchId)
    && optional(payload, 'finalized_at', nullableTime) && optional(payload, 'deleted_at', value => value === null)
    && optional(payload, 'finalized_by', value => value === null || version(value)))
  const recordIds = new Set<string>(), students = new Set<string>(), guests = new Set<string>()
  for (const row of payload.records) {
    requireValid(object(row) && uuid(row.id) && uuid(row.student_id) && version(row.version)
      && oneOf(row.state, ['unmarked', 'present', 'absent']) && optional(row, 'deleted_at', value => value === null))
    requireValid(!recordIds.has(row.id) && !students.has(row.student_id))
    recordIds.add(row.id); students.add(row.student_id)
  }
  for (const row of payload.guests) {
    requireValid(object(row) && uuid(row.id) && typeof row.display_name === 'string'
      && Array.from(row.display_name).length >= 1 && Array.from(row.display_name).length <= 120
      && oneOf(row.gender, ['male', 'female', 'unspecified']) && row.state === 'present'
      && oneOf(row.status, ['pending', 'promoted', 'linked', 'merged'])
      && optional(row, 'resolved_student_id', nullableUuid) && optional(row, 'merged_into_guest_id', nullableUuid))
    requireValid(!guests.has(row.id)); guests.add(row.id)
  }
}

// This validates the current producer, not a new wire protocol. Unknown metadata
// is retained; known semantic fields must never be coerced, omitted or guessed.
export function validatePullPage(value: unknown, previousCursor: string, profile: ProfileRecord, now: Date): PullPage {
  requireValid(object(value) && Array.isArray(value.changes) && value.changes.length <= 100
    && object(value.page) && cursor(value.page.next_cursor) && typeof value.page.has_more === 'boolean'
    && cursor(previousCursor) && object(value.lease))
  requireValid(BigInt(value.page.next_cursor) >= BigInt(previousCursor))
  let sequence = BigInt(previousCursor)
  for (const change of value.changes) {
    requireValid(object(change) && cursor(change.sequence) && BigInt(change.sequence) > sequence,
      'Synchronization changes are not ordered.')
    sequence = BigInt(change.sequence)
    requireValid(uuid(change.entity_id) && version(change.version) && uuid(change.ministry_id) && object(change.payload))
    if (change.entity_type === 'attendance_session' && change.action === 'upsert') attendance(change.payload, change, profile)
    else requireValid(change.entity_type === 'ministry_assignment' && change.action === 'tombstone'
      && change.payload.ministry_id === change.ministry_id)
  }
  requireValid(sequence <= BigInt(value.page.next_cursor), 'The synchronization cursor precedes a returned change.')
  requireValid(!value.page.has_more || BigInt(value.page.next_cursor) > BigInt(previousCursor),
    'The synchronization cursor must advance when more pages remain.')
  const lease = value.lease
  requireValid(typeof lease.actor_id === 'string' && /^\d{1,20}$/.test(lease.actor_id)
    && uuid(lease.church_id) && uuid(lease.device_id) && uuid(lease.membership_id)
    && typeof lease.signature === 'string' && /^[a-f\d]{64}$/i.test(lease.signature)
    && timestamp(lease.issued_at) && timestamp(lease.expires_at)
    && Date.parse(lease.issued_at) < Date.parse(lease.expires_at) && Date.parse(lease.expires_at) > now.getTime())
  try { assertLeaseMatchesProfile(profile, lease as unknown as OfflineLease) }
  catch { throw new SyncDownloadError('The returned offline authorization could not be verified.') }
  return value as unknown as PullPage
}
