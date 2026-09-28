export type AttendanceState = 'unmarked' | 'present' | 'absent'
export type AttendanceSessionStatus = 'draft' | 'finalized_pending' | 'finalized' | 'needs_review' | 'revised'

export interface AttendanceEntry {
  studentId: string
  displayName: string
  gender: 'male' | 'female' | 'unspecified'
  state: AttendanceState
}

export interface AttendanceDraft {
  id: string
  profileId: string
  churchId: string
  ministryId: string
  ministryName: string
  attendanceDate: string
  status: AttendanceSessionStatus
  version: number
  entries: AttendanceEntry[]
  updatedAt: string
}

export interface AttendanceStudentInput {
  id: string
  displayName: string
  gender: AttendanceEntry['gender']
}

export interface CreateAttendanceDraftInput {
  profileId: string
  churchId: string
  ministryId: string
  ministryName: string
  attendanceDate: string
  students: AttendanceStudentInput[]
}

export type AttendanceEventAction =
  | 'attendance.draft_created'
  | 'attendance.student_marked'
  | 'attendance.bulk_marked'
  | 'attendance.finalized'

export interface LocalAttendanceEvent {
  id: string
  profileId: string
  entityId: string
  action: AttendanceEventAction
  baseVersion: number
  occurredAt: string
  payload: Record<string, unknown>
}
