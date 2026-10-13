import { useContext, useEffect, useState } from 'react'
import { ChurchNavigationContext } from './workspace-context'
import { EmptyState, LoadingState, StatusBanner } from '../components/ui/Foundations'
import { HomeIcon } from '../components/ui/HomeIcon'
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
  const attendance = <a className="home-button" href={href('/account/attendance')}><HomeIcon id="attendance" />Take attendance</a>
  return <div className={`church-home home-${role ?? 'unknown'}`}>
    <header className="home-heading"><div><h1>Home</h1>{role === 'owner' && <p>Ready for Sunday.</p>}</div>{role === 'owner' && attendance}</header>
    {role === 'teacher' && <a className="home-sync-notice" aria-label="Sync status not checked Open Sync" href={href('/account/sync')}><span className="home-notice-icon"><HomeIcon id="sync" /></span><span><strong>Sync status not checked</strong><span className="home-notice-action">Open Sync<HomeIcon id="arrow" /></span></span><HomeIcon id="arrow" /></a>}
    {role === 'owner' ? <div className="home-actions">
      <section className="home-card" aria-labelledby="home-device-title"><span className="home-icon-circle"><HomeIcon id="device" /></span><h2 id="home-device-title">Device status</h2><p>Check saved work and synchronization on this device.</p><a className="home-text-link" href={href('/account/sync')}>Open Sync<HomeIcon id="arrow" /></a></section>
      <section className="home-card" aria-labelledby="home-prepare-title"><span className="home-icon-circle home-icon-green"><HomeIcon id="people" /></span><h2 id="home-prepare-title">Prepare your ministry</h2><ul>{['Students', 'Ministries', 'Teachers'].map(label => <li key={label}><a className="home-text-link" href={href(`/account/${label.toLowerCase()}`)}>{label}<HomeIcon id="arrow" /></a></li>)}</ul></section>
      <section className="home-card" aria-labelledby="home-review-title"><span className="home-icon-circle home-icon-amber"><HomeIcon id="conflicts" solid /></span><h2 id="home-review-title">Needs review</h2><p>View attendance exceptions.</p><a className="home-text-link" href={href('/account/conflicts')}>Open review<HomeIcon id="arrow" /></a></section>
    </div> : <div className="home-ministries">
      {state.kind === 'loading' ? <LoadingState label="Loading assigned ministries…" /> : state.kind === 'error' ? <StatusBanner tone="warning">Assigned ministries are unavailable. Open My ministries to check access and retry.</StatusBanner> : state.ministries.length === 0 ? <EmptyState title="No assigned ministries available" description="Ask your church Owner about your ministry assignment." /> : state.ministries.map(item => <section className="home-card home-ministry-card" key={item.id} aria-labelledby={`home-ministry-${item.id}`}>
        <div className="home-ministry-heading"><span className="home-icon-circle"><HomeIcon id="people" /></span><div><h2 id={`home-ministry-${item.id}`}>{item.name}</h2><p>Your assigned ministry</p></div></div>
        {attendance}<a className="home-button home-button-secondary" href={href('/account/reports')}><HomeIcon id="more" />Recent sessions</a>
      </section>)}
      {(state.kind !== 'ready' || state.ministries.length === 0) && <a className="home-text-link home-ministry-link" href={href('/account/ministries')}>My ministries<HomeIcon id="arrow" /></a>}
    </div>}
    {role === 'owner' ? <div className="home-sync-information"><HomeIcon id="info" /><p>Sync status is available from every workspace.</p></div> : <a className="home-device-information" href={href('/account/sync')}><HomeIcon id="info" />Device status not checked · Open Sync</a>}
  </div>
}
