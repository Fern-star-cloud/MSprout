// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { authRequest } from '../auth/transport'
import { enableBirthdayNotifications, notificationCapability } from './notification-permission'

vi.mock('../auth/transport', () => ({ authRequest: vi.fn() }))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })

it('requests notification permission only from the deliberate enable action and records denial', async () => {
  const requestPermission = vi.fn().mockResolvedValue('denied')
  vi.stubGlobal('Notification', { permission: 'default', requestPermission })
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} })
  vi.stubGlobal('PushManager', class {})
  vi.mocked(authRequest).mockResolvedValue({ configured: true, vapid_public_key: 'public-key' } as never)

  expect(notificationCapability().state).toBe('available')
  expect(requestPermission).not.toHaveBeenCalled()
  await expect(enableBirthdayNotifications('11111111-1111-4111-8111-111111111111')).resolves.toMatchObject({ state: 'denied' })
  expect(requestPermission).toHaveBeenCalledOnce()
  expect(notificationCapability().state).toBe('denied')
});

it('explains the Home Screen requirement on iPhone when push is unavailable', () => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone)' })
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })

  expect(notificationCapability()).toMatchObject({ state: 'ios-install-required' })
});

it('does not request browser permission before authenticated workspace preflight succeeds', async () => {
  const requestPermission = vi.fn().mockResolvedValue('granted')
  vi.stubGlobal('Notification', { permission: 'default', requestPermission })
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} })
  vi.stubGlobal('PushManager', class {})
  vi.mocked(authRequest).mockRejectedValue(new Error('unauthenticated'))

  await expect(enableBirthdayNotifications('11111111-1111-4111-8111-111111111111')).resolves.toMatchObject({ state: 'error' })
  expect(requestPermission).not.toHaveBeenCalled()
})
