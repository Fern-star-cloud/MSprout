// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../../App'

afterEach(() => { cleanup(); history.replaceState(null, '', '/'); vi.unstubAllGlobals() })
it.each([
  ['/', 'Choose a device profile'],
  ['/account/login', 'Welcome back'],
  ['/account/forgot-password', 'Reset your password'],
  ['/account/verify-email', 'Verify your email'],
  ['/account/mfa', 'Protect your account'],
  ['/account/reset-password', 'Choose a new password'],
  ['/account/platform-login', 'Platform sign in'],
  ['/account/platform-setup', 'Set up sage.dev'],
  ['/account/application', 'Your church, ready to grow'],
  ['/account/platform-applications', 'Church applications'],
  ['/account/teachers', 'Teachers'],
  ['/account/reports', 'Attendance reports'],
  ['/account/teacher-invitation', 'Teacher invitation'],
])('opens %s from a direct browser visit', async (path, heading) => {
  if (path === '/account/reports' || path === '/account/teachers') {
    const church = '11111111-1111-4111-8111-111111111111'
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async endpoint => {
      const role = path === '/account/teachers' ? 'owner' : 'teacher'
      if (endpoint === '/auth/session') return Response.json({ id: 7, email_verified: true, workspaces: [{ church_id: church, name: 'Church', role }] })
      if (endpoint === '/api/me') return Response.json({ id: 7, email_verified: true, memberships: [{ church_id: church, role, status: 'active' }], active_session: { mfa_confirmed: true } })
      if (String(endpoint).startsWith('/api/attendance-reports')) return Response.json({ data: { role: 'teacher', can_export: false, summary: { attendance_rate: 0, pending_count: 0, finalized_record_count: 0, conflict_count: 0, correction_count: 0 }, sessions: [] } })
      return Response.json({ data: [] })
    }))
  }
  history.replaceState(null, '', path)
  render(<App />)
  expect(await screen.findByRole('heading', { name: heading })).toBeTruthy()
})
