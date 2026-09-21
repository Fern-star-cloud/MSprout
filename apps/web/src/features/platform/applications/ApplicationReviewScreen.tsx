import { useEffect, useState } from 'react'
import type { components } from '../../../api/generated'
import { authRequest, safeAuthMessage } from '../../auth/transport'

type Application = components['schemas']['ChurchApplication']
type Status = Application['status']

export function ApplicationReviewScreen() {
  const [items, setItems] = useState<Application[]>([])
  const [selected, setSelected] = useState<Application | null>(null)
  const [status, setStatus] = useState<Status>('pending')
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); setSelected(null); setItems([]) }
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    let active = true
    if (online) void authRequest<components['schemas']['ApplicationReviewPage']>(`/platform/applications?status=${status}&page=${page}`)
      .then((result) => { if (active) { setItems(result.data); setMore(result.has_more); setError('') } })
      .catch((failure) => { if (active) { setError(safeAuthMessage(failure)); setItems([]); setSelected(null) } })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [online, page, status, revision])
  async function decide(decision: 'approve' | 'reject', body?: components['schemas']['RejectChurchApplication']) {
    if (!selected || busy) return
    setBusy(true); setError('')
    try {
      const path = `/platform/applications/${selected.id}/${decision}`
      const result = body ? await authRequest<Application>(path, 'POST', body) : await authRequest<Application>(path, 'POST')
      setSelected(result); setItems((current) => current.filter((item) => item.id !== result.id))
    } catch (failure) { setError(safeAuthMessage(failure)) }
    finally { setBusy(false) }
  }
  return <section className="auth-card" aria-labelledby="review-heading"><p className="eyebrow">sage.dev</p><h2 id="review-heading">Church applications</h2>
    {!online ? <p role="alert">Connect to the internet to review applications.</p> : <>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Loading…</p>}
      {!selected ? <>
        <label htmlFor="application-status">Application status</label>
        <select id="application-status" value={status} disabled={busy} onChange={(event) => { setStatus(event.target.value as Status); setPage(1); setBusy(true); setItems([]) }}>
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
        {!busy && !error && items.length === 0 && <p>No applications in this category.</p>}
        <ul className="application-list">{items.map((item) => <li key={item.id}><strong>{item.church_name}</strong><p>{item.city}</p>
          <button disabled={busy} onClick={async () => {
            setBusy(true); setError('')
            try { setSelected(await authRequest<Application>(`/platform/applications/${item.id}`)) }
            catch (failure) { setError(safeAuthMessage(failure)) }
            finally { setBusy(false) }
          }}>Review {item.church_name}</button></li>)}</ul>
        <div className="application-actions">
          {page > 1 && <button disabled={busy} onClick={() => { setPage(page - 1); setBusy(true); setItems([]) }}>Previous page</button>}
          {more && <button disabled={busy} onClick={() => { setPage(page + 1); setBusy(true); setItems([]) }}>Next page</button>}
          <button className="secondary" disabled={busy} onClick={() => { setBusy(true); setRevision(revision + 1) }}>Refresh applications</button>
        </div>
      </> : <>
        <h3>{selected.church_name}</h3><p role="status">{{ pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' }[selected.status]}</p>
        <dl><dt>City</dt><dd>{selected.city}</dd><dt>Timezone</dt><dd>{selected.timezone}</dd>{selected.address && <><dt>Address</dt><dd>{selected.address}</dd></>}</dl>
        {selected.status === 'pending' ? <>
          <p>Approval creates one church workspace and makes the applicant its Owner. The decision cannot be changed here.</p>
          <button disabled={busy} onClick={() => void decide('approve')}>Approve application</button>
          <form aria-label="Reject application" onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void decide('reject', { category: data.get('category') as components['schemas']['RejectChurchApplication']['category'], reason: String(data.get('reason')) })
          }}>
            <label htmlFor="category">Decision category</label><select id="category" name="category" defaultValue="incomplete" disabled={busy}><option value="incomplete">Incomplete information</option><option value="duplicate">Duplicate</option><option value="ineligible">Ineligible</option><option value="other">Other</option></select>
            <label htmlFor="reason">Reason for applicant</label><textarea id="reason" name="reason" required maxLength={500} disabled={busy} />
            <p>Give a brief explanation. Do not include personal or sensitive information.</p><button type="submit" disabled={busy}>Reject application</button>
          </form>
        </> : <p>{selected.reason}</p>}
        <button className="secondary" disabled={busy} onClick={() => { setSelected(null); setBusy(true); setRevision(revision + 1) }}>Back to applications</button>
      </>}
    </>}
    <p><a href="/account/platform-login">Platform sign in</a></p>
  </section>
}
