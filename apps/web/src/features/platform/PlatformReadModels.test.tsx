// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authRequest } from '../auth/transport'
import { SystemHealthScreen } from './system-health/SystemHealthScreen'
import { AuditScreen } from '../audit/AuditScreen'

vi.mock('../auth/transport', async (original) => ({ ...await original() as typeof import('../auth/transport'), authRequest: vi.fn() }))
const session = { handle: 'sage.dev', online_only: true }
const health = { status: 'degraded', checked_at: '2026-10-11T00:00:00Z', api: { status: 'ok' }, database: { status: 'ok', size_bytes: 2048, growth_bytes_24h: null }, queue: { status: 'degraded', pending_count: 2, oldest_age_seconds: 70, failed_24h: 1 }, scheduler: { status: 'degraded', last_run_at: null }, birthdays: { status: 'ok', last_dispatch_at: null, failed_24h: 0 }, synchronization: { status: 'ok', events_24h: 0, rejected_24h: 0, open_conflicts: 0, error_rate: 0 } }
const event = { id: '00000000-0000-4000-8000-000000000001', category: 'platform', action: 'application.approved', result: 'success', correlation_id: '00000000-0000-4000-8000-000000000002', occurred_at: '2026-10-11T00:00:00Z', metadata: { secret: 'PRIVATE_SENTINEL' }, actor_id: 'PRIVATE_SENTINEL', target_id: 'PRIVATE_SENTINEL' }
beforeEach(() => { vi.mocked(authRequest).mockImplementation(async path => {
  if (path === '/platform/me') return session
  if (path === '/platform/system-health') return health
  if (path === '/health/live') return { status: 'ok' }
  return { scope: 'platform', page: 1, per_page: 25, has_more: true, data: [event] }
}) })
afterEach(() => { cleanup(); vi.mocked(authRequest).mockReset() })

it('shows server degradation and separate public liveness without requesting protected readiness', async () => {
  render(<SystemHealthScreen />)
  await screen.findAllByText('Degraded')
  await screen.findByText('Responding')
  expect(screen.getByText(/Readiness is unavailable/)).toBeDefined()
  expect(vi.mocked(authRequest).mock.calls.some(call => call[0].includes('/health/ready'))).toBe(false)
  expect(vi.mocked(authRequest).mock.calls[0][0]).toBe('/platform/me')
})
it('does not equate failed frontend requests with backend ill health or retain stale healthy results', async () => {
  render(<SystemHealthScreen />)
  await screen.findAllByText('Degraded')
  vi.mocked(authRequest).mockImplementation(async path => { if (path === '/platform/me') return session; throw new TypeError('PRIVATE_SENTINEL') })
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await screen.findByText(/does not prove/)
  expect(screen.queryAllByText('Degraded')).toHaveLength(0)
  expect(document.body.textContent).not.toContain('PRIVATE_SENTINEL')
})
it('denies church identities and does not request operational or audit data', async () => {
  vi.mocked(authRequest).mockResolvedValue({ handle: 'church-user', online_only: true })
  render(<SystemHealthScreen />)
  await screen.findByRole('alert')
  expect(authRequest).toHaveBeenCalledTimes(1)
})
it('renders only sanitized platform event fields and uses supported page-size pagination', async () => {
  render(<AuditScreen platform />)
  await screen.findByText('Application approved')
  expect(document.body.textContent).not.toContain('PRIVATE_SENTINEL')
  await userEvent.selectOptions(screen.getByLabelText('Events per page'), '50')
  await waitFor(() => expect(authRequest).toHaveBeenCalledWith('/platform/audit-events?page=1&per_page=50'))
})
it('rejects wrong audit scope and unknown health measurements', async () => {
  vi.mocked(authRequest).mockImplementation(async path => path === '/platform/me' ? session : { scope: 'church', page: 1, per_page: 25, has_more: false, data: [event] })
  render(<AuditScreen platform />)
  await screen.findByRole('alert')
  expect(screen.queryByText('Application approved')).toBeNull()
})
it('suppresses pending health and audit responses after authorization revocation', async () => {
  let complete!: (value: unknown) => void
  vi.mocked(authRequest).mockImplementation(async path => path === '/platform/me' ? session : path === '/health/live' ? { status: 'ok' } : new Promise(resolve => { complete = resolve }))
  render(<SystemHealthScreen />)
  await waitFor(() => expect(complete).toBeDefined())
  act(() => window.dispatchEvent(new CustomEvent('platform-session-invalidated', { detail: { status: 403 } })))
  await act(async () => complete(health))
  expect(screen.queryAllByText('Degraded')).toHaveLength(0)
  expect(screen.queryByText('Responding')).toBeNull()
})
it('does not display unknown operational measurements or arbitrary diagnostics', async () => {
  vi.mocked(authRequest).mockImplementation(async path => path === '/platform/me' ? session : path === '/health/live' ? { status: 'ok' } : { ...health, status: 'PRIVATE_SENTINEL', diagnostics: 'PRIVATE_SENTINEL' })
  render(<SystemHealthScreen />)
  await screen.findByRole('alert')
  expect(document.body.textContent).not.toContain('PRIVATE_SENTINEL')
  expect(screen.queryByText('Queue')).toBeNull()
})
it('uses a neutral label for unsupported audit actions including object property names', async () => {
  vi.mocked(authRequest).mockImplementation(async path => path === '/platform/me' ? session : { scope: 'platform', page: 1, per_page: 25, has_more: false, data: [{ ...event, action: 'constructor' }] })
  render(<AuditScreen platform />)
  await screen.findByText('Activity recorded')
  expect(document.body.textContent).not.toContain('constructor')
})
it('preserves chronological integrity and rejects a page of church events', async () => {
  vi.mocked(authRequest).mockImplementation(async path => path === '/platform/me' ? session : { scope: 'platform', page: 1, per_page: 25, has_more: false, data: [{ ...event, category: 'church' }] })
  render(<AuditScreen platform />)
  await screen.findByRole('alert')
  expect(screen.queryByText('Application approved')).toBeNull()
})
it('clears audit events when an expired session denies a later page', async () => {
  render(<AuditScreen platform />)
  await screen.findByText('Application approved')
  vi.mocked(authRequest).mockRejectedValue({ status: 401 })
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Application approved')).toBeNull()
})
