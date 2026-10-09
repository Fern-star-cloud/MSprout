import { useContext, useEffect, useState } from 'react'
import { ChurchNavigationContext } from './workspace-context'
import { navigationFor } from './navigation'
import { EmptyState, LoadingState, StatusBanner } from '../components/ui/Foundations'
import { authRequest } from '../features/auth/transport'
import type { components } from '../api/generated'
type Ministry = components['schemas']['Ministry']
type RosterState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; ministries: Ministry[] }

export function HomeScreen() {
  const { workspace, assignments } = useContext(ChurchNavigationContext)
  const [state, setState] = useState<RosterState>({ kind: 'loading' })
  const church = workspace?.church_id, role = workspace?.role, scope = assignments.join(',')
  const href = (path: string) => new URLSearchParams(location.search).get('church') === church ? `${path}?church=${encodeURIComponent(church ?? '')}` : path
  useEffect(() => {
    if (!church || role !== 'teacher') return
    let active = true
    void authRequest<{ data: Ministry[] }>('/api/ministries', 'GET', undefined, church).then(result => {
      if (active) setState({ kind: 'ready', ministries: result.data.filter(item => scope.split(',').includes(item.id) && item.status === 'active') })
    }).catch(() => { if (active) setState({ kind: 'error' }) })
    return () => { active = false }
  }, [church, role, scope])
  return <div className="church-home">
    <header className="home-heading"><div><p className="eyebrow">Church workspace</p><h1>Home</h1><p>{role === 'owner' ? 'Prepare your ministry and keep attendance work moving.' : 'Your assigned ministries and next actions.'}</p></div><a className="action-link" href={href('/account/attendance')}>Take attendance</a></header>
    <div className="home-actions">
      <section className="dashboard-card"><h2>Sync &amp; device</h2><p>Check encrypted profiles, pending work and synchronization recovery on this device.</p><a href={href('/account/sync')}>Open Sync</a></section>
      {role === 'owner' ? <><section className="dashboard-card"><h2>Prepare your ministry</h2><p>Use your existing church management tools.</p><ul>{navigationFor('owner').people.map(item => <li key={item.id}><a href={href(item.href)}>{item.label}</a></li>)}</ul></section><section className="dashboard-card"><h2>Needs review</h2><p>Open the review queue to check attendance exceptions and temporary guests.</p><a href={href('/account/conflicts')}>Open review</a></section></> : <section className="dashboard-card"><h2>My ministries</h2>
        {state.kind === 'loading' ? <LoadingState label="Loading assigned ministries…" /> : state.kind === 'error' ? <StatusBanner tone="warning">Assigned ministries are unavailable. Open My ministries to check access and retry.</StatusBanner> : state.ministries.length === 0 ? <EmptyState title="No assigned ministries available" description="Ask your church Owner about your ministry assignment." /> : <ul>{state.ministries.map(item => <li key={item.id}>{item.name}</li>)}</ul>}
        <p><a href={href('/account/ministries')}>My ministries</a></p><a href={href('/account/reports')}>Recent sessions</a>
      </section>}
    </div>
    <StatusBanner tone="info">Online church access and local encrypted attendance are separate. Open Account for sign-in and assurance, or Sync &amp; device for device work.</StatusBanner>
  </div>
}
