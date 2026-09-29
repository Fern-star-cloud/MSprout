import { useEffect, useState } from 'react'
import { disableBirthdayNotifications, enableBirthdayNotifications, notificationCapability, type NotificationCapability } from './notification-permission'

export function NotificationSettings({ churchId }: { churchId: string }) {
  const [capability, setCapability] = useState<NotificationCapability>(() => notificationCapability())
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (capability.state !== 'available' || Notification.permission !== 'granted') return
    void navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (subscription) setCapability({ state: 'enabled', message: 'Birthday notifications are enabled on this device.' })
      }).catch(() => undefined)
  }, [capability.state])

  async function enable() {
    setWorking(true)
    setCapability(await enableBirthdayNotifications(churchId))
    setWorking(false)
  }

  async function disable() {
    setWorking(true)
    setCapability(await disableBirthdayNotifications(churchId))
    setWorking(false)
  }

  return <section className="notification-settings" aria-labelledby="notification-heading">
    <h2 id="notification-heading">Birthday notifications</h2>
    <p>{capability.message}</p>
    {capability.state === 'available' && <button type="button" disabled={working} onClick={() => void enable()}>
      {working ? 'Enabling…' : 'Enable Birthday Notifications'}
    </button>}
    {capability.state === 'enabled' && <button className="secondary" type="button" disabled={working} onClick={() => void disable()}>
      {working ? 'Turning off…' : 'Turn off notifications'}
    </button>}
  </section>
}
