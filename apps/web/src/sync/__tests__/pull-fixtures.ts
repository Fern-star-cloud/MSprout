import type { ProfileRecord } from '../../offline/schema'

export const ids = {
  profile: '00000000-0000-4000-8000-000000000001', church: '00000000-0000-4000-8000-000000000010',
  device: '00000000-0000-4000-8000-000000000020', membership: '00000000-0000-4000-8000-000000000030',
  ministry: '00000000-0000-4000-8000-000000000040', session: '00000000-0000-4000-8000-000000000050',
  student: '00000000-0000-4000-8000-000000000060', record: '00000000-0000-4000-8000-000000000070',
  guest: '00000000-0000-4000-8000-000000000080',
}
export const testNow = new Date('2026-10-16T00:00:00Z')
export const profile = { id: ids.profile, actorId: '11', churchId: ids.church, deviceId: ids.device } as ProfileRecord
export function validPage() {
  return {
    changes: [{ sequence: '3', entity_type: 'attendance_session', entity_id: ids.session, version: 2,
      action: 'upsert', ministry_id: ids.ministry,
      payload: { id: ids.session, ministry_id: ids.ministry, attendance_date: '2026-10-16', status: 'draft', version: 2,
        finalized_at: null, deleted_at: null,
        records: [{ id: ids.record, student_id: ids.student, state: 'present', version: 1, deleted_at: null }],
        guests: [{ id: ids.guest, display_name: 'Synthetic guest', gender: 'unspecified', state: 'present', status: 'pending', resolved_student_id: null, merged_into_guest_id: null }],
      } }],
    page: { next_cursor: '5', has_more: false },
    lease: { actor_id: '11', church_id: ids.church, device_id: ids.device, membership_id: ids.membership,
      issued_at: '2026-10-16T00:00:00Z', expires_at: '2026-10-30T00:00:00Z', signature: 'b'.repeat(64) },
  }
}
