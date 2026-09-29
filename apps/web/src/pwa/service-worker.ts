/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision?: string | null; integrity?: string }>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
  new NetworkOnly(),
)

const applicationShell = createHandlerBoundToURL('/index.html')
registerRoute(new NavigationRoute(applicationShell, { denylist: [/^\/api(?:\/|$)/] }))

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

self.addEventListener('push', (event) => {
  let payload: { title?: unknown; body?: unknown; url?: unknown; tag?: unknown } = {}
  try { payload = event.data?.json() ?? {} } catch { payload = {} }
  const countOnlyBody = typeof payload.body === 'string' && /^\d+ (?:child is|children are) celebrating today\. Open the app to view\.$/.test(payload.body)
    ? payload.body : 'Open the app to view today\'s birthdays.'
  event.waitUntil(self.registration.showNotification('Birthday reminder', {
    body: countOnlyBody,
    tag: 'birthday-reminder',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: '/account/birthdays' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const birthdayUrl = new URL('/account/birthdays', self.location.origin).href
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(birthdayUrl)
        return
      }
    }
    await self.clients.openWindow(birthdayUrl)
  })())
})

clientsClaim()
