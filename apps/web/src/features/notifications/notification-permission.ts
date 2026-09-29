import { authRequest } from '../auth/transport'

export type NotificationState = 'available' | 'enabled' | 'denied' | 'unsupported' | 'ios-install-required' | 'error'
export interface NotificationCapability { state: NotificationState; message: string }

const denialKey = 'msprout:birthday-notifications-denied'
const deviceKey = 'msprout:push-device-id'

function isIos(): boolean {
  return /iPad|iPhone|iPod/i.test(globalThis.navigator?.userAgent ?? '')
}

export function notificationCapability(): NotificationCapability {
  if (!('Notification' in globalThis) || !globalThis.navigator?.serviceWorker || !('PushManager' in globalThis)) {
    return isIos()
      ? { state: 'ios-install-required', message: 'On iPhone or iPad, add Sprout to your Home Screen before enabling notifications.' }
      : { state: 'unsupported', message: 'Birthday notifications are not supported in this browser.' }
  }
  if (Notification.permission === 'denied'
    || (Notification.permission === 'default' && globalThis.localStorage?.getItem(denialKey) === 'true')) {
    return { state: 'denied', message: 'Notifications are blocked. You can change this in your browser settings.' }
  }
  return { state: 'available', message: 'Get one private reminder at 8:00 AM. Names appear only after you open Sprout.' }
}

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
  return new Uint8Array(bytes.buffer)
}

function deviceId(): string {
  const existing = globalThis.localStorage?.getItem(deviceKey)
  if (existing && /^[a-f\d-]{36}$/i.test(existing)) return existing
  const created = crypto.randomUUID()
  globalThis.localStorage?.setItem(deviceKey, created)
  return created
}

export async function enableBirthdayNotifications(churchId: string): Promise<NotificationCapability> {
  const capability = notificationCapability()
  if (!['available', 'enabled'].includes(capability.state)) return capability

  let config: { vapid_public_key: string; configured: boolean }
  try {
    config = await authRequest<{ vapid_public_key: string; configured: boolean }>('/api/push-subscriptions/config', 'GET', undefined, churchId)
  } catch {
    return { state: 'error', message: 'Sign in to your church workspace before enabling notifications.' }
  }
  if (!config.configured || !config.vapid_public_key) return { state: 'error', message: 'Notifications are not configured yet.' }

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') {
    globalThis.localStorage?.setItem(denialKey, 'true')
    return { state: 'denied', message: 'Notifications were not enabled. Sprout will not ask again.' }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(config.vapid_public_key),
      })
    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Incomplete push subscription')
    await authRequest('/api/push-subscriptions', 'POST', {
      device_id: deviceId(), permission: 'granted',
      subscription: { endpoint: json.endpoint, expirationTime: json.expirationTime ?? null, keys: json.keys },
    }, churchId)
    globalThis.localStorage?.removeItem(denialKey)

    return { state: 'enabled', message: 'Birthday notifications are enabled on this device.' }
  } catch {
    return { state: 'error', message: 'Notifications could not be enabled. Please try again later.' }
  }
}

export async function disableBirthdayNotifications(churchId: string): Promise<NotificationCapability> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    const id = globalThis.localStorage?.getItem(deviceKey)
    if (id && /^[a-f\d-]{36}$/i.test(id)) {
      await authRequest(`/api/push-subscriptions/${id}`, 'DELETE', undefined, churchId)
    }
    await subscription?.unsubscribe()

    return { state: 'available', message: 'Birthday notifications are off on this device.' }
  } catch {
    return { state: 'error', message: 'Notifications could not be disabled. Please try again later.' }
  }
}
