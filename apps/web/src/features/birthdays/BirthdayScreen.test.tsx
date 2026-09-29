// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { authRequest } from '../auth/transport'
import { BirthdayScreen } from './BirthdayScreen'

vi.mock('../auth/transport', () => ({ authRequest: vi.fn(), safeAuthMessage: () => 'Unable to load birthdays.' }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

it('shows authorized names from the in-app fallback without rendering birthdates', async () => {
  vi.mocked(authRequest).mockResolvedValue({ data: {
    local_date: '2026-09-29', timezone: 'Asia/Manila', role: 'teacher', count: 1,
    birthdays: [{ id: 'child-1', display_name: 'Assigned Child', turning_age: 8, ministry_names: ['Primary'] }],
  } } as never)

  render(<BirthdayScreen initialChurchId="11111111-1111-4111-8111-111111111111" />)

  expect(await screen.findByText('Assigned Child')).toBeTruthy()
  expect(screen.getByText(/Turning 8/)).toBeTruthy()
  expect(document.body.textContent).not.toContain('2018-09-29')
});
