// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ImportScreen } from './ImportScreen'
import { escapeSpreadsheetCell } from './csv'
import { authRequest, authUpload } from '../auth/transport'

vi.mock('../auth/transport', () => ({
  authRequest: vi.fn(), authUpload: vi.fn(), authDownload: vi.fn(),
  safeAuthMessage: () => 'Safe import error.',
}))

const church = '11111111-1111-4111-8111-111111111111'
const batch = '22222222-2222-4222-8222-222222222222'
const ministry = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  history.pushState({}, '', `/imports?church=${church}`)
  vi.mocked(authRequest).mockImplementation(async (path) => {
    if (path === '/api/me') return { memberships: [{ church_id: church, role: 'owner', status: 'active' }], active_session: { mfa_confirmed: true } } as never
    if (path === '/api/ministries') return { data: [{ id: ministry, name: 'Primary Kids', status: 'active', version: 1 }] } as never
    return { id: batch, state: 'completed', counts: { committed: 2, excluded: 1, duplicate: 0 } } as never
  })
  vi.mocked(authUpload).mockResolvedValue({
    id: batch, state: 'previewed', expires_at: '2026-09-29T00:00:00Z',
    counts: { valid: 1, invalid: 1, duplicate: 0, needs_mapping: 1 },
    rows: [
      { id: '44444444-4444-4444-8444-444444444444', row_number: 2, status: 'valid', source: { first_name: 'Ari', last_name: 'Sprout' }, data: { first_name: 'Ari', last_name: 'Sprout', gender: 'unspecified' }, ministry_names: [], ministry_ids: [], unknown_ministries: [], errors: [], outcome: null },
      { id: '55555555-5555-4555-8555-555555555555', row_number: 3, status: 'needs_mapping', source: { first_name: 'Noah', last_name: 'Green', ministries: 'New Group' }, data: { first_name: 'Noah', last_name: 'Green', gender: 'male' }, ministry_names: ['New Group'], ministry_ids: [], unknown_ministries: ['New Group'], errors: [], outcome: null },
      { id: '66666666-6666-4666-8666-666666666666', row_number: 4, status: 'invalid', source: { first_name: 'Bad', last_name: 'Date', birthdate: '01/02/2018' }, data: {}, ministry_names: [], ministry_ids: [], unknown_ministries: [], errors: ['Birthdate must use YYYY-MM-DD or a genuine Excel date cell.'], outcome: null },
    ],
  } as never)
})

afterEach(() => { cleanup(); vi.clearAllMocks() })

it('uploads previews maps excludes and idempotently commits selected rows', async () => {
  const user = userEvent.setup()
  render(<ImportScreen />)
  await screen.findByRole('heading', { name: 'Import students' })
  const file = new File(['first_name,last_name\nAri,Sprout'], 'students.csv', { type: 'text/csv' })
  await user.upload(screen.getByLabelText('Student spreadsheet'), file)
  fireEvent.submit(screen.getByRole('button', { name: 'Preview import' }).closest('form')!)

  await waitFor(() => expect(authUpload).toHaveBeenCalledWith('/api/imports/students/preview', file, church))
  expect(await screen.findByText('1 valid')).not.toBeNull()
  expect(screen.getByText('1 invalid')).not.toBeNull()
  await user.selectOptions(screen.getByLabelText('Map New Group'), ministry)
  await user.click(screen.getByLabelText('Approve row 3'))
  await user.click(screen.getByRole('button', { name: 'Commit 2 students' }))

  await waitFor(() => expect(authRequest).toHaveBeenCalledWith(
    `/api/imports/${batch}/commit`, 'POST', expect.objectContaining({
      row_ids: ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'],
      ministry_mappings: { 'New Group': ministry },
    }), church,
  ))
  expect(await screen.findByText('2 students imported.')).not.toBeNull()
})

it('escapes spreadsheet-executable prefixes in corrected CSV cells', () => {
  expect(escapeSpreadsheetCell('=cmd')).toBe("'=cmd")
  expect(escapeSpreadsheetCell('+1')).toBe("'+1")
  expect(escapeSpreadsheetCell('-1')).toBe("'-1")
  expect(escapeSpreadsheetCell('@name')).toBe("'@name")
  expect(escapeSpreadsheetCell('  =cmd')).toBe("'  =cmd")
  expect(escapeSpreadsheetCell('Ari')).toBe('Ari')
})
