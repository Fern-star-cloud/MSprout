// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { authRequest } from '../../auth/transport'
import { SystemHealthScreen } from './SystemHealthScreen'

vi.mock('../../auth/transport', async (original) => ({ ...await original<typeof import('../../auth/transport')>(), authRequest: vi.fn() }))
afterEach(() => { cleanup(); vi.mocked(authRequest).mockReset() })

it('shows sanitized aggregate operating health without tenant details', async () => {
  vi.mocked(authRequest).mockResolvedValue({
    status: 'healthy', checked_at: '2026-09-29T00:00:00Z',
    api: { status: 'ok' }, database: { status: 'ok', size_bytes: 2048, growth_bytes_24h: 128 },
    queue: { status: 'ok', pending_count: 1, oldest_age_seconds: 4, failed_24h: 0 },
    scheduler: { status: 'ok', last_run_at: '2026-09-29T00:00:00Z' },
    birthdays: { status: 'ok', last_dispatch_at: '2026-09-28T00:00:00Z', failed_24h: 0 },
    synchronization: { status: 'ok', events_24h: 10, rejected_24h: 1, open_conflicts: 1, error_rate: 0.1 },
  })

  render(<SystemHealthScreen />)

  expect(await screen.findByRole('heading', { name: 'System health' })).toBeDefined()
  expect(await screen.findByText('Healthy')).toBeDefined()
  expect(screen.getByText(/1 pending/)).toBeDefined()
  expect(screen.queryByText(/church|student|child/i)).toBeNull()
  expect(authRequest).toHaveBeenCalledWith('/platform/system-health')
});

it('does not render metrics when platform authorization fails', async () => {
  vi.mocked(authRequest).mockRejectedValue({ status: 403 })
  render(<SystemHealthScreen />)
  expect(await screen.findByRole('alert')).toBeDefined()
  expect(screen.queryByText('Queue')).toBeNull()
});
