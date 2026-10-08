import { useCallback, useEffect, useState } from 'react'
import { useWorkspaceChurchId } from '../../app/workspace-context'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { NotificationSettings } from '../notifications/NotificationSettings'
import { loadOfflineBirthdays } from './offline-birthdays'

interface BirthdayEntry { id: string; display_name: string; turning_age: number; ministry_names: string[] }
interface BirthdayProjection {
  local_date: string
  timezone: string
  role: 'owner' | 'teacher'
  count: number
  birthdays: BirthdayEntry[]
}

export function BirthdayScreen({
  initialChurchId = new URLSearchParams(globalThis.location?.search ?? '').get('church') ?? '',
}: { initialChurchId?: string }) {
  const churchId = useWorkspaceChurchId(initialChurchId)
  const [birthdays, setBirthdays] = useState<BirthdayProjection | null>(null)
  const [loading, setLoading] = useState(Boolean(initialChurchId))
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!churchId) return
    setLoading(true)
    try {
      const response = await authRequest<{ data: BirthdayProjection }>('/api/birthdays/today', 'GET', undefined, churchId)
      setBirthdays(response.data)
      setError('')
    } catch (failure) {
      try {
        const offline = await loadOfflineBirthdays(churchId)
        setBirthdays(offline)
        setError(offline ? '' : safeAuthMessage(failure))
      } catch {
        setBirthdays(null)
        setError(safeAuthMessage(failure))
      }
    } finally {
      setLoading(false)
    }
  }, [churchId])

  useEffect(() => {
    const timer = globalThis.setTimeout(() => { void load() }, 0)
    return () => globalThis.clearTimeout(timer)
  }, [load])

  return <section className="birthday-screen" aria-labelledby="birthday-heading">
    <header><p className="eyebrow">Church workspace · Today</p><h1 id="birthday-heading">Today&apos;s Birthdays</h1></header>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading today&apos;s birthdays…</p>}
    {birthdays && <>
      <p className="birthday-summary">{birthdays.count === 0 ? 'No children are celebrating today.' : `${birthdays.count} ${birthdays.count === 1 ? 'child is' : 'children are'} celebrating today.`}</p>
      <ul className="birthday-list">
        {birthdays.birthdays.map((birthday) => <li key={birthday.id}>
          <span aria-hidden="true" className="birthday-mark">🎂</span>
          <span><strong>{birthday.display_name}</strong><small>Turning {birthday.turning_age}{birthday.ministry_names.length > 0 ? ` · ${birthday.ministry_names.join(', ')}` : ''}</small></span>
        </li>)}
      </ul>
      <p className="privacy-note">Names are shown only inside your authorized church workspace. Push reminders contain a count only.</p>
      <NotificationSettings churchId={churchId} />
    </>}
  </section>
}
