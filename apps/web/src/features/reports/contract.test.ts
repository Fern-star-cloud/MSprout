import definition from '../../../../../contracts/openapi.yaml?raw'
import { parse } from 'yaml'
import { expect, it } from 'vitest'

it('defines filtered attendance reports and Owner CSV export', () => {
  const contract = parse(definition)
  expect(contract.paths['/attendance-reports'].get.operationId).toBe('getAttendanceReport')
  expect(contract.paths['/attendance-reports/export'].get.operationId).toBe('exportAttendanceReport')
  expect(contract.components.schemas.AttendanceReport.required).toEqual(expect.arrayContaining(['summary', 'sessions', 'can_export']))
  expect(contract.components.schemas.AttendanceReportSession.properties).not.toHaveProperty('date_of_birth')
})
