import type { components } from '../../api/generated'

export type Conflict = components['schemas']['AttendanceConflict']
export type Guest = components['schemas']['PendingAttendanceGuest']
export type GuestResult = components['schemas']['GuestResolutionResult']
export type Student = { id: string; display_name: string; status: 'active' }
export type Choice = 'existing' | 'incoming'
export type GuestAction = 'promote' | 'link' | 'merge'
export type Target = { kind: 'conflict'; item: Conflict } | { kind: 'guest'; item: Guest }
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 600
const time = (value: unknown) => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
const actor = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0
const state = (value: unknown) => value === 'present' || value === 'absent'
function evidence(value: unknown) {
  return object(value) && object(value.value) && state(value.value.state)
    && (value.actor_id === null || actor(value.actor_id)) && (value.device_id === null || uuid(value.device_id))
    && (value.local_time === null || time(value.local_time)) && (value.server_time === null || time(value.server_time))
    && (value.correlation_id === null || uuid(value.correlation_id))
}
export function validConflict(value: unknown): value is Conflict {
  return object(value) && uuid(value.id) && uuid(value.session_id) && uuid(value.record_id) && value.field === 'state'
    && Number.isSafeInteger(value.base_version) && Number(value.base_version) >= 0 && ['open','resolved'].includes(String(value.status))
    && evidence(value.existing) && evidence(value.incoming)
}
export function validGuest(value: unknown): value is Guest {
  return object(value) && uuid(value.id) && uuid(value.session_id) && text(value.display_name) && Array.from(value.display_name).length <= 120
    && ['male','female','unspecified'].includes(String(value.gender)) && actor(value.actor_id) && uuid(value.device_id) && time(value.local_time) && time(value.server_time)
}
export function list<T>(value: unknown, guard: (row: unknown) => row is T): T[] {
  if (!object(value) || !Array.isArray(value.data) || value.data.length > 100 || !value.data.every(guard)
    || new Set(value.data.map(row => (row as {id:string}).id)).size !== value.data.length) throw Error('Invalid review response')
  return value.data
}
export function validStudent(value: unknown): value is Student { return object(value) && uuid(value.id) && text(value.display_name) && value.status === 'active' }
export function normalizeReason(value: string): string | null {
  const reason = value.replace(/[\s\p{Z}]+/gu, ' ').trim()
  return reason && Array.from(reason).length <= 500 ? reason : null
}
export function sameConflict(first: unknown, second: unknown): boolean {
  if (!validConflict(first) || !validConflict(second)) return false
  const projection = (row: Conflict) => [row.id,row.session_id,row.record_id,row.field,row.base_version,row.status,
    ...[row.existing,row.incoming].flatMap(side=>[side.value.state,side.actor_id,side.device_id,side.local_time,side.server_time,side.correlation_id])]
  return JSON.stringify(projection(first)) === JSON.stringify(projection(second))
}
export function validGuestResult(value: unknown, id: string, action: GuestAction): value is GuestResult {
  return object(value) && value.id === id && value.status === ({promote:'promoted',link:'linked',merge:'merged'} as const)[action]
    && Number.isSafeInteger(value.version) && Number(value.version) > 0
    && (action === 'merge' ? uuid(value.merged_into_guest_id) && (value.student_id === null || uuid(value.student_id)) : uuid(value.student_id) && value.merged_into_guest_id === null)
}
export function validResolution(value: unknown, id: string): boolean {
  return object(value) && value.id === id && value.status === 'resolved' && uuid(value.revision_id) && state(value.effective_state) && Number.isSafeInteger(value.version) && Number(value.version) > 0
}
export const attendanceValue = (value: 'present' | 'absent') => value === 'present' ? 'Present' : 'Absent'
