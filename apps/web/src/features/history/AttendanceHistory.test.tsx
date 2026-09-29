// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { AttendanceHistory } from './AttendanceHistory'

afterEach(cleanup)

it('renders finalized history with correction links and no child birthdates', () => {
  render(<AttendanceHistory sessions={[{
    id: '11111111-1111-4111-8111-111111111111',
    ministry_id: '22222222-2222-4222-8222-222222222222', ministry_name: 'Primary',
    attendance_date: '2026-09-20', status: 'revised', finalized_at: '2026-09-20T08:00:00.000Z',
    present_count: 8, absent_count: 2, attendance_rate: 0.8, correction_count: 1,
  }]} />)

  expect(screen.getByRole('heading', { name: 'Finalized sessions' })).toBeTruthy()
  expect(screen.getAllByText('Primary').length).toBeGreaterThan(0)
  expect(screen.getAllByText('80%').length).toBeGreaterThan(0)
  expect(screen.getAllByRole('link', { name: '1 correction' }).length).toBeGreaterThan(0)
  expect(screen.queryByText(/birth/i)).toBeNull()
})
