// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { authRequest, safeAuthMessage } from './transport'

afterEach(() => vi.unstubAllGlobals())

it('shows fixed preservation feedback for compatibility instead of an application conflict', () => {
  expect(safeAuthMessage(new ApiError('attendance_compatibility_required', 'Untrusted server text', '', 409)))
    .toBe('This attendance request cannot be processed safely. Keep this profile and browser storage; saved local attendance must be preserved. Synchronization is incomplete.')
})

it('retains the allowlisted compatibility identity without trusting server text or invalidating authorization', async () => {
  const invalidated = vi.fn()
  window.addEventListener('church-workspace-invalidated', invalidated)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'attendance_compatibility_required', message: 'Private raw data', correlation_id: '11111111-1111-4111-8111-111111111111' }), { status: 409 })))
  try {
    await expect(authRequest('/api/attendance-reports', 'GET', undefined, '11111111-1111-4111-8111-111111111111'))
      .rejects.toMatchObject({ code: 'attendance_compatibility_required', status: 409 })
    expect(invalidated).not.toHaveBeenCalled()
  } finally { window.removeEventListener('church-workspace-invalidated', invalidated) }
})
