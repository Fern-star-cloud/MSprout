import { useCallback, useEffect, useState } from 'react'
import type { components } from '../../api/generated'
import { authRequest, safeAuthMessage } from '../auth/transport'

type Ministry = components['schemas']['Ministry']

export function MinistriesScreen() {
  const [church, setChurch] = useState(() => new URLSearchParams(location.search).get('church') ?? '')
  const [selectedChurch, setSelectedChurch] = useState(church)
  const [rows, setRows] = useState<Ministry[]>([])
  const [owner, setOwner] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const load = useCallback(async () => {
    try {
      const me = await authRequest<components['schemas']['ChurchAccount']>('/api/me', 'GET', undefined, church)
      const allowed = me.memberships.some(item => item.church_id === church && item.status === 'active' && item.role === 'owner') && me.active_session.mfa_confirmed
      setOwner(allowed)
      const list = await authRequest<{data: Ministry[]}>('/api/ministries' + (allowed ? '?include_archived=true' : ''), 'GET', undefined, church)
      setRows(list.data); setError('')
    } catch (failure) { setOwner(false); setRows([]); setError(safeAuthMessage(failure)) }
  }, [church])
  useEffect(() => {
    if (!church) return
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [church, load, revision])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget
    try { await authRequest('/api/ministries', 'POST', {name: String(new FormData(form).get('name'))}, church); form.reset(); setRevision(value => value + 1) }
    catch (failure) { setError(safeAuthMessage(failure)) }
  }
  async function change(row: Ministry, status: 'archive' | 'restore') {
    try { await authRequest(`/api/ministries/${row.id}/${status}`, 'POST', undefined, church); setRevision(value => value + 1) }
    catch (failure) { setError(safeAuthMessage(failure)) }
  }
  async function rename(event: React.FormEvent<HTMLFormElement>, row: Ministry) {
    event.preventDefault()
    try { await authRequest(`/api/ministries/${row.id}`, 'PUT', {name: String(new FormData(event.currentTarget).get('name'))}, church); setRevision(value => value + 1) }
    catch (failure) { setError(safeAuthMessage(failure)) }
  }
  return <section className="auth-card roster-card" aria-labelledby="ministries-heading">
    <p className="eyebrow">Church workspace · Online only</p><h2 id="ministries-heading">Ministries</h2>
    {!church && <form onSubmit={event => { event.preventDefault(); setChurch(selectedChurch) }}><label htmlFor="ministry-church">Church workspace ID</label><input id="ministry-church" required value={selectedChurch} onChange={event => setSelectedChurch(event.target.value)} /><button>Open workspace</button></form>}
    {error && <p role="alert">{error}</p>}
    {owner && <form className="roster-form" aria-label="Create ministry" onSubmit={event => void save(event)}><label htmlFor="new-ministry">New ministry</label><input id="new-ministry" name="name" maxLength={120} required /><button>Add ministry</button></form>}
    <ul className="roster-list">{rows.map(row => <li key={row.id}><span>{row.name}{row.status === 'archived' && <small> · Archived</small>}
      {owner && <details><summary>Edit ministry name</summary><form onSubmit={event => void rename(event, row)}><label>Name<input name="name" defaultValue={row.name} maxLength={120} required /></label><button>Save name</button></form></details>}</span>
      {owner && <button className="secondary" onClick={() => void change(row, row.status === 'active' ? 'archive' : 'restore')}>{row.status === 'active' ? 'Archive' : 'Restore'}</button>}</li>)}</ul>
    <a href={`/students${church ? `?church=${encodeURIComponent(church)}` : ''}`}>Manage students</a>
  </section>
}
