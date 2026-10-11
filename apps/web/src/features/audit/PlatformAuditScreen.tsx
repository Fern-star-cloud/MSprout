import { useCallback, useEffect, useRef, useState } from 'react'
import type { components } from '../../api/generated'
import { Button, ErrorSummary, LoadingState } from '../../components/ui/Foundations'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { readPlatformSession } from '../platform-auth/platform-session'
import { accessDenied, revealFocus, usePlatformLifecycle } from '../platform/lifecycle'
import { instant, uuid } from '../platform/applications/application-projection'
import '../platform/platform-administration.css'

const labels: Record<string, string> = {
  'application.approved': 'Application approved', 'application.rejected': 'Application rejected',
  'platform.mfa.enrolled': 'Administrator MFA enrolled', 'platform.mfa.confirmed': 'Administrator MFA confirmed',
  'platform.mfa.challenge': 'Administrator MFA verified', 'platform.mfa.recovered': 'Administrator recovery used',
  'platform.auth.login': 'Administrator sign-in started', 'platform.auth.logout': 'Administrator signed out',
  'platform.admin.bootstrapped': 'Administrator invited',
}
type Event = Pick<components['schemas']['AuditEvent'], 'id' | 'result' | 'correlation_id' | 'occurred_at'> & { label: string }
type Page = { data: Event[]; has_more: boolean }
function projection(value: components['schemas']['AuditPage'], page: number, size: number): Page {
  if (value?.scope !== 'platform') throw { status: 403 }
  if (value.page !== page || value.per_page !== size || typeof value.has_more !== 'boolean' || !Array.isArray(value.data) || value.data.length > size) throw new Error('Unavailable audit page')
  const data = value.data.map(event => {
    if (!event || event.category !== 'platform' || !uuid(event.id) || !uuid(event.correlation_id) || !instant(event.occurred_at) || !['success', 'failure', 'denied'].includes(event.result)) throw new Error('Unavailable audit event')
    return { id: event.id, result: event.result, correlation_id: event.correlation_id, occurred_at: event.occurred_at, label: Object.hasOwn(labels, event.action) ? labels[event.action] : 'Activity recorded' }
  })
  if (new Set(data.map(event => event.id)).size !== data.length || data.some((event, index) => index > 0 && (Date.parse(event.occurred_at) > Date.parse(data[index - 1].occurred_at) || (event.occurred_at === data[index - 1].occurred_at && event.id > data[index - 1].id)))) throw new Error('Unavailable audit order')
  return { data, has_more: value.has_more }
}
export function PlatformAuditScreen() {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(25)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<Page | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const focusResult = useRef(false)
  const clear = useCallback(() => { setData(null); setLoading(false); setError('Platform access must be verified again.') }, [])
  const { online, begin, current, invalidate } = usePlatformLifecycle(clear)
  useEffect(() => {
    if (!online) return
    const token = begin()
    void (async () => {
      setLoading(true); setData(null); setError('')
      try {
        await readPlatformSession()
        if (!current(token)) return
        const result = projection(await authRequest<components['schemas']['AuditPage']>(`/platform/audit-events?page=${page}&per_page=${size}`), page, size)
        if (current(token)) setData(result)
      } catch (failure) { if (current(token)) { if (accessDenied(failure)) invalidate(); else setError(safeAuthMessage(failure)) } }
      finally { if (current(token)) setLoading(false) }
    })()
    return () => { begin() }
  }, [begin, current, invalidate, online, page, size, revision])
  useEffect(() => { if (!loading && focusResult.current) { focusResult.current = false; revealFocus(heading.current) } }, [loading])
  function go(next: number) { setData(null); focusResult.current = true; setPage(next) }
  return <section className="platform-admin" aria-labelledby="audit-heading">
    <p className="eyebrow">sage.dev · Immutable history</p><h1 id="audit-heading" ref={heading} tabIndex={-1}>Platform audit</h1>
    <p>Platform events, newest first. References identify recorded events without exposing private diagnostics.</p>
    {!online && <ErrorSummary message="Connect to the internet to view Platform audit." />}
    {online && loading && <LoadingState label="Checking access and loading Platform audit…" />}
    {online && error && <ErrorSummary message={error} />}
    <label htmlFor="audit-size">Events per page</label><select id="audit-size" value={size} disabled={loading || !online} onChange={event => { setData(null); setSize(Number(event.target.value)); setPage(1) }}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select>
    {online && data && <>
      {data.data.length === 0 ? <p>No activity to display.</p> : <ol className="platform-audit-list">{data.data.map(event => <li key={event.id}><strong>{event.label}</strong><p>{event.result === 'success' ? 'Completed' : event.result === 'denied' ? 'Denied' : 'Failed'} · <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString()}</time></p><small>Reference: {event.correlation_id}</small></li>)}</ol>}
      <nav className="platform-admin-actions" aria-label="History pages"><Button variant="secondary" disabled={loading || page === 1} onClick={() => go(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={loading || !data.has_more || page >= 10000} onClick={() => go(page + 1)}>Next</Button></nav>
    </>}
    <Button variant="secondary" disabled={loading || !online} onClick={() => { setData(null); focusResult.current = true; setRevision(value => value + 1) }}>Refresh audit</Button>
  </section>
}
