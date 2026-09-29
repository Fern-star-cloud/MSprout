import definition from '../../../../../contracts/openapi.yaml?raw'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

const contract = parse(definition)

it('defines the attendance states and versioned tenant session projection', () => {
  const schemas = contract.components.schemas
  expect(schemas.AttendanceState.enum).toEqual(['unmarked', 'present', 'absent'])
  expect(schemas.AttendanceSessionStatus.enum).toEqual(['draft', 'finalized_pending', 'finalized', 'needs_review', 'revised'])
  expect(schemas.AttendanceSession.additionalProperties).toBe(false)
  expect(schemas.AttendanceSession.required).toEqual(expect.arrayContaining(['church_id', 'ministry_id', 'attendance_date', 'status', 'version']))
  expect(schemas.AttendanceRecord.required).toEqual(expect.arrayContaining(['student_id', 'state', 'version']))
  expect(schemas.AttendanceGuest.required).toEqual(expect.arrayContaining(['display_name', 'gender', 'state', 'status']))
  expect(contract.paths['/sync-conflicts/{id}/resolve'].post.operationId).toBe('resolveSyncConflict')
  expect(contract.paths['/attendance-guests/{id}/promote'].post.operationId).toBe('promoteAttendanceGuest')
  expect(contract.paths['/attendance-guests'].get.operationId).toBe('listPendingAttendanceGuests')
})
