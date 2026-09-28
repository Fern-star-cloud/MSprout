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
})
