import { useCallback, useEffect, useRef, useState } from 'react'
import type { components } from '../../../api/generated'
import { Button, Dialog, ErrorSummary, LoadingState, StatusBadge } from '../../../components/ui/Foundations'
import { authRequest, safeAuthMessage } from '../../auth/transport'
import { readPlatformSession } from '../../platform-auth/platform-session'
import { accessDenied, revealFocus, usePlatformLifecycle } from '../lifecycle'
import { applicationProjection, type Application, type Status } from './application-projection'
import { beginDecision, completeDecision, decisionState, unknownDecision } from './application-decisions'
import '../platform-administration.css'

type Rejection = components['schemas']['RejectChurchApplication']
type Confirmation = { application: Application; action: 'approve' | 'reject'; rejection?: Rejection }
const outcome = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' }
const categories = { incomplete: 'Incomplete information', duplicate: 'Duplicate', ineligible: 'Ineligible', other: 'Other' }

export function ApplicationReviewScreen() {
  const [items, setItems] = useState<Application[]>([])
  const [selected, setSelected] = useState<Application | null>(null)
  const [status, setStatus] = useState<Status>('pending')
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState<Rejection['category']>('incomplete')
  const operation = useRef<number | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const cancel = useRef<HTMLButtonElement | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const errorFocus = useRef<HTMLDivElement | null>(null)
  const focusResult = useRef(false)
  const restoreCancellation = useRef(false)
  const clear = useCallback(() => {
    setItems([]); setMore(false); setSelected(null); setConfirmation(null); setReason(''); setCategory('incomplete')
    setNotice(''); setError('Platform access must be verified again.'); setBusy(false); operation.current = null
  }, [])
  const { online, begin, current, invalidate } = usePlatformLifecycle(clear)
  useEffect(() => {
    if (restoreCancellation.current && !confirmation) {
      restoreCancellation.current = false
      revealFocus(trigger.current)
    }
    if (focusResult.current && !busy && !confirmation) {
      focusResult.current = false
      revealFocus(error ? errorFocus.current : heading.current)
    }
  }, [busy, confirmation, error, selected])
  function cancelConfirmation() {
    if (busy) return
    restoreCancellation.current = true
    setConfirmation(null)
  }
  useEffect(() => {
    if (!online) return
    const token = begin(); operation.current = token
    void (async () => {
      setBusy(true); setItems([]); setMore(false); setSelected(null); setError(''); setNotice(''); setConfirmation(null)
      try {
        await readPlatformSession()
        if (!current(token)) return
        const result = await authRequest<components['schemas']['ApplicationReviewPage']>(`/platform/applications?status=${status}&page=${page}`)
        if (!current(token)) return
        if (result.page !== page || typeof result.has_more !== 'boolean' || !Array.isArray(result.data) || result.data.length > 20) throw new Error('Unavailable queue')
        const list = result.data.map(item => applicationProjection(item))
        if (new Set(list.map(item => item.id)).size !== list.length || list.some(item => item.status !== status)) throw new Error('Unavailable queue')
        setItems(list); setMore(result.has_more)
      } catch (failure) { if (current(token)) { if (accessDenied(failure)) invalidate(); else setError(safeAuthMessage(failure)) } }
      finally { if (current(token)) { setBusy(false); if (operation.current === token) operation.current = null } }
    })()
    return () => { begin() }
  }, [begin, current, invalidate, online, page, status, revision])

  async function readDetail(id: string, check = false) {
    if (operation.current !== null || !online) return
    const token = begin(); operation.current = token; setBusy(true); setError(''); focusResult.current = true
    try {
      await readPlatformSession()
      if (!current(token)) return
      const value = applicationProjection(await authRequest<Application>(`/platform/applications/${id}`), id)
      if (!current(token)) return
      if (value.status !== 'pending') completeDecision(id)
      setSelected(value); setItems([])
      setNotice(decisionState(id) ? 'The decision outcome is uncertain. Check its status before any further action.' : check ? 'The server-confirmed decision is shown below.' : '')
    } catch (failure) { if (current(token)) { if (accessDenied(failure)) invalidate(); else { setItems([]); setSelected(null); setError(safeAuthMessage(failure)) } } }
    finally { if (current(token)) { setBusy(false); if (operation.current === token) operation.current = null } }
  }

  async function decide() {
    if (!confirmation || operation.current !== null || !online || !beginDecision(confirmation.application.id)) return
    const snapshot = confirmation
    const id = snapshot.application.id
    const token = begin(); operation.current = token; setBusy(true); setError(''); setNotice('')
    let submitted = false
    try {
      await readPlatformSession()
      if (!current(token)) { completeDecision(id); return }
      const latest = applicationProjection(await authRequest<Application>(`/platform/applications/${id}`), id)
      if (!current(token)) { completeDecision(id); return }
      if (latest.status !== 'pending' || JSON.stringify(latest) !== JSON.stringify(snapshot.application)) {
        completeDecision(id); setSelected(latest); setNotice(latest.status === 'pending' ? 'Application details changed. Review them and confirm again.' : 'This application has already been decided. The server-confirmed outcome is shown.')
        return
      }
      submitted = true
      const path = `/platform/applications/${id}/${snapshot.action}`
      const result = applicationProjection(snapshot.rejection ? await authRequest<Application>(path, 'POST', snapshot.rejection) : await authRequest<Application>(path, 'POST'), id)
      if (result.status === 'pending') throw new Error('Unconfirmed decision')
      completeDecision(id)
      if (current(token)) { setSelected(result); setReason(''); setNotice('The server-confirmed decision is shown below.') }
    } catch (failure) {
      const statusCode = (failure as { status?: number })?.status
      if (!submitted || [401, 403, 419, 422, 429].includes(statusCode ?? 0)) {
        completeDecision(id)
        if (current(token)) { if (accessDenied(failure)) invalidate(); else setError(safeAuthMessage(failure)) }
      } else {
        unknownDecision(id)
        if (!current(token)) return
        try {
          await readPlatformSession()
          if (!current(token)) return
          const actual = applicationProjection(await authRequest<Application>(`/platform/applications/${id}`), id)
          if (!current(token)) return
          setSelected(actual)
          if (actual.status !== 'pending') { completeDecision(id); setNotice('The server-confirmed decision is shown below.') }
          else setError('The decision outcome is uncertain. Check decision status; do not submit another decision.')
        } catch (reconciliationFailure) { if (current(token)) { if (accessDenied(reconciliationFailure)) invalidate(); else setError('The decision outcome is uncertain. Reconnect and check decision status before continuing.') } }
      }
    } finally {
      if (current(token)) { setConfirmation(null); setBusy(false); focusResult.current = true; if (operation.current === token) operation.current = null }
    }
  }

  const blocked = !!selected && !!decisionState(selected.id)
  return <section className="platform-admin" aria-labelledby="review-heading">
    <p className="eyebrow">sage.dev · Application review</p><h1 id="review-heading" ref={heading} tabIndex={-1}>Church applications</h1>
    {!online ? <ErrorSummary message="Connect to the internet to review applications." /> : <>
      {error && <ErrorSummary message={error} ref={errorFocus} />}
      {notice && <p role="status">{notice}</p>}
      {busy && <LoadingState label="Verifying access and loading applications…" />}
      {!selected ? <>
        <label htmlFor="application-status">Application status</label>
        <select id="application-status" value={status} disabled={busy} onChange={event => { setItems([]); setStatus(event.target.value as Status); setPage(1) }}>
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
        {!busy && !error && items.length === 0 && <p>No applications in this category.</p>}
        <ul className="platform-review-list">{items.map(item => <li key={item.id}><h2>{item.church_name ?? 'Application'}</h2><p>{item.city ?? 'City unavailable'}</p><StatusBadge>{outcome[item.status]}</StatusBadge><Button onClick={() => { setReason(''); setCategory('incomplete'); void readDetail(item.id) }} disabled={busy}>Review {item.church_name ?? 'application'}</Button></li>)}</ul>
        <nav className="platform-admin-actions" aria-label="Application pages"><Button variant="secondary" disabled={busy || page === 1} onClick={() => setPage(page - 1)}>Previous page</Button><span>Page {page}</span><Button variant="secondary" disabled={busy || !more || page >= 100000} onClick={() => setPage(page + 1)}>Next page</Button><Button variant="secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh applications</Button></nav>
      </> : <>
        <h2>{selected.church_name ?? 'Application'}</h2><p role="status">{outcome[selected.status]}</p>
        <dl className="platform-detail"><dt>City</dt><dd>{selected.city ?? 'Unavailable'}</dd><dt>Timezone</dt><dd>{selected.timezone ?? 'Unavailable'}</dd>{selected.address && <><dt>Address</dt><dd>{selected.address}</dd></>}<dt>Submitted</dt><dd><time dateTime={selected.submitted_at}>{new Date(selected.submitted_at).toLocaleString()}</time></dd>{selected.decided_at && <><dt>Decided</dt><dd><time dateTime={selected.decided_at}>{new Date(selected.decided_at).toLocaleString()}</time></dd></>}</dl>
        {selected.status === 'pending' ? <>
          <p>Approval creates one church workspace and makes the applicant its Owner. Decisions cannot be changed here.</p>
          <Button disabled={busy || blocked} onClick={event => { trigger.current = event.currentTarget; setConfirmation({ application: selected, action: 'approve' }) }}>Approve application</Button>
          <form aria-label="Reject application" onSubmit={event => {
            event.preventDefault()
            if (busy || blocked) return
            if (!reason.trim()) { setError('Enter a reason for the applicant before confirming rejection.'); focusResult.current = true; return }
            setError('')
            trigger.current = event.currentTarget.querySelector('button')
            setConfirmation({ application: selected, action: 'reject', rejection: { category, reason: reason.trim() } })
          }}>
            <label htmlFor="category">Decision category</label><select id="category" value={category} disabled={busy || blocked} onChange={event => setCategory(event.target.value as Rejection['category'])}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label htmlFor="reason">Reason for applicant</label><textarea id="reason" required maxLength={500} value={reason} disabled={busy || blocked} onChange={event => setReason(event.target.value)} aria-describedby="reason-guidance" />
            <p id="reason-guidance">Give a brief explanation. Do not include personal or sensitive information.</p><Button type="submit" variant="danger" disabled={busy || blocked}>Reject application</Button>
          </form>
        </> : <>{selected.category && <p>Decision category: {categories[selected.category]}</p>}{selected.reason && <p>Reason: {selected.reason}</p>}<p>This recorded decision is final. No further actions are available.</p></>}
        {blocked && <Button disabled={busy} onClick={() => void readDetail(selected.id, true)}>Check decision status</Button>}
        <Button variant="secondary" disabled={busy} onClick={() => { setSelected(null); setItems([]); setReason(''); setRevision(value => value + 1); focusResult.current = true }}>Back to applications</Button>
      </>}
    </>}
    <Dialog open={!!confirmation} title={confirmation?.action === 'reject' ? 'Confirm rejection' : 'Confirm approval'} description="Review the selected application and consequences before confirming. Your Platform assurance will be checked again." initialFocus={cancel} returnFocus={trigger} onClose={cancelConfirmation}>
      {confirmation && <><p><strong>{confirmation.application.church_name ?? 'Application'}</strong></p><p>{confirmation.application.city}</p><p>Application reference: {confirmation.application.id}</p>
        {confirmation.rejection ? <><p>Rejection records a final decision and queues a notification containing the reason for the applicant.</p><p>{categories[confirmation.rejection.category]}</p><p>{confirmation.rejection.reason}</p></> : <p>Approval creates one church workspace and assigns its Owner. This decision cannot be reversed here.</p>}
        <div className="platform-admin-actions"><Button ref={cancel} variant="secondary" disabled={busy} onClick={cancelConfirmation}>Cancel</Button><Button variant={confirmation.action === 'reject' ? 'danger' : 'primary'} busy={busy} onClick={() => void decide()}>{confirmation.action === 'reject' ? 'Confirm rejection' : 'Confirm approval'}</Button></div>
      </>}
    </Dialog>
  </section>
}
