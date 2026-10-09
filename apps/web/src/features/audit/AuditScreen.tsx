import { useEffect, useState } from 'react'
import type { components } from '../../api/generated'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { useWorkspaceChurchId } from '../../app/workspace-context'

const labels: Record<string, string> = {
  'teacher.invited': 'Teacher invited', 'invitation.accepted': 'Invitation accepted', 'invitation.revoked': 'Invitation revoked',
  'teacher.assignments_changed': 'Assignments changed', 'teacher.revoked': 'Teacher access revoked', 'ownership.transferred': 'Ownership transferred',
  'application.approved': 'Application approved', 'application.rejected': 'Application rejected',
  'platform.mfa.enrolled': 'Administrator MFA enrolled', 'platform.mfa.confirmed': 'Administrator MFA confirmed',
  'platform.mfa.challenge': 'Administrator MFA verified', 'platform.mfa.recovered': 'Administrator recovery used',
  'platform.auth.login': 'Administrator sign-in started', 'platform.auth.logout': 'Administrator signed out',
  'platform.admin.bootstrapped': 'Administrator invited',
  'sync.accepted': 'Sync accepted', 'sync.rejected': 'Sync rejected', 'sync.conflict': 'Sync needs review',
  'submission.accepted': 'Submission accepted', 'submission.rejected': 'Submission needs review',
}

export function AuditScreen({ platform = false }: { platform?: boolean }) {
  const workspaceChurch = useWorkspaceChurchId(new URLSearchParams(location.search).get('church') ?? '')
  const [church, setChurch] = useState(platform ? '' : workspaceChurch)
  const [input, setInput] = useState(church)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<components['schemas']['AuditPage'] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const update = () => { const connected = navigator.onLine; setOnline(connected); if (!connected) { setData(null); setLoading(true) } }
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    let active = true
    if (online && (platform || church)) void (async () => {
      try {
        let scope: 'platform' | 'church' | 'own' = 'platform'
        if (platform) {
          const me = await authRequest<{ online_only: boolean }>('/platform/me')
          if (!me.online_only) throw { status: 403 }
        } else {
          const me = await authRequest<components['schemas']['ChurchAccount']>('/api/me', 'GET', undefined, church)
          const membership = me.memberships.find(member => member.church_id === church && member.status === 'active')
          if (!membership || (membership.role === 'owner' && !me.active_session?.mfa_confirmed)) throw { status: 403 }
          scope = membership.role === 'owner' ? 'church' : 'own'
        }
        const list = await authRequest<components['schemas']['AuditPage']>(`${platform ? '/platform' : '/api'}/audit-events?page=${page}&per_page=25`, 'GET', undefined, platform ? undefined : church)
        if (list.scope !== scope) throw { status: 403 }
        if (active) { setData(list); setError('') }
      } catch (failure) { if (active) { setData(null); setError(safeAuthMessage(failure)) } }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [church, page, platform, online])

  function go(next: number) { setData(null); setLoading(true); setPage(next) }

  return <section className="auth-card" aria-labelledby="audit-heading">
    <p className="eyebrow">History · Online only</p>
    <h2 id="audit-heading">{data?.scope === 'platform' ? 'Platform audit' : data?.scope === 'church' ? 'Church audit' : data?.scope === 'own' ? 'My activity' : 'Activity history'}</h2>
    {!platform && !church && <form onSubmit={event => { event.preventDefault(); setChurch(input) }}>
      <label htmlFor="audit-church">Church workspace ID</label><input id="audit-church" required value={input} onChange={event => setInput(event.target.value)} />
      <button>Open history</button>
    </form>}
    {!online && <p role="alert">Connect to the internet to view activity history.</p>}
    {online && loading && (platform || church) && <p role="status">Checking access…</p>}
    {online && error && <p role="alert">{error}</p>}
    {online && data && <>
      {data.data.length === 0 ? <p>No activity to display.</p> : <ol className="audit-events">{data.data.map(event => <li key={event.id}>
        <strong>{labels[event.action] ?? 'Activity recorded'}</strong>
        <p>{event.result === 'success' ? 'Completed' : event.result === 'denied' ? 'Denied' : 'Failed'} · <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString()}</time></p>
        <small>Reference: {event.correlation_id}</small>
      </li>)}</ol>}
      <nav aria-label="History pages"><button disabled={page === 1} onClick={() => go(page - 1)}>Previous</button><span>Page {page}</span><button disabled={!data.has_more || page >= 10000} onClick={() => go(page + 1)}>Next</button></nav>
    </>}
  </section>
}
