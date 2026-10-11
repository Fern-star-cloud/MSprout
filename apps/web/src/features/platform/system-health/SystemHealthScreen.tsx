import { useCallback, useEffect, useRef, useState } from 'react'
import type { components } from '../../../api/generated'
import { Button, ErrorSummary, LoadingState, StatusBadge } from '../../../components/ui/Foundations'
import { authRequest, safeAuthMessage } from '../../auth/transport'
import { readPlatformSession } from '../../platform-auth/platform-session'
import { accessDenied, revealFocus, usePlatformLifecycle } from '../lifecycle'
import { instant } from '../applications/application-projection'
import '../platform-administration.css'

type Health = components['schemas']['SystemHealth']
const count = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0
const timestamp = (value: unknown) => value === null || instant(value)
const status = (value: unknown) => value === 'ok' || value === 'degraded'
const time = (value: string | null) => value ? new Date(value).toLocaleString() : 'No activity recorded'
const label = (value: string) => value === 'ok' ? 'Operational' : 'Degraded'
function projection(value: Health): Health {
  if (!value || !['healthy', 'degraded'].includes(value.status) || !instant(value.checked_at) || value.api?.status !== 'ok' || value.database?.status !== 'ok'
    || !count(value.database.size_bytes) || !(value.database.growth_bytes_24h === null || Number.isSafeInteger(value.database.growth_bytes_24h))
    || !status(value.queue?.status) || ![value.queue.pending_count, value.queue.oldest_age_seconds, value.queue.failed_24h].every(count)
    || !status(value.scheduler?.status) || !timestamp(value.scheduler.last_run_at)
    || !status(value.birthdays?.status) || !timestamp(value.birthdays.last_dispatch_at) || !count(value.birthdays.failed_24h)
    || !status(value.synchronization?.status) || ![value.synchronization.events_24h, value.synchronization.rejected_24h, value.synchronization.open_conflicts].every(count)
    || !Number.isFinite(value.synchronization.error_rate) || value.synchronization.error_rate < 0 || value.synchronization.error_rate > 1) throw new Error('Unavailable health projection')
  return { status: value.status, checked_at: value.checked_at, api: { status: 'ok' }, database: { status: 'ok', size_bytes: value.database.size_bytes, growth_bytes_24h: value.database.growth_bytes_24h }, queue: { status: value.queue.status, pending_count: value.queue.pending_count, oldest_age_seconds: value.queue.oldest_age_seconds, failed_24h: value.queue.failed_24h }, scheduler: { status: value.scheduler.status, last_run_at: value.scheduler.last_run_at }, birthdays: { status: value.birthdays.status, last_dispatch_at: value.birthdays.last_dispatch_at, failed_24h: value.birthdays.failed_24h }, synchronization: { status: value.synchronization.status, events_24h: value.synchronization.events_24h, rejected_24h: value.synchronization.rejected_24h, open_conflicts: value.synchronization.open_conflicts, error_rate: value.synchronization.error_rate } }
}
export function SystemHealthScreen() {
  const [health, setHealth] = useState<Health | null>(null)
  const [live, setLive] = useState<'responding' | 'unknown' | null>(null)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const focusResult = useRef(false)
  const clear = useCallback(() => { setHealth(null); setLive(null); setVerified(false); setLoading(false); setError('Platform access must be verified again.') }, [])
  const { online, begin, current, invalidate } = usePlatformLifecycle(clear)
  useEffect(() => {
    if (!online) return
    const token = begin()
    void (async () => {
      setHealth(null); setLive(null); setVerified(false); setError(''); setLoading(true)
      try {
        await readPlatformSession()
        if (!current(token)) return
        setVerified(true)
        await Promise.all([
          (async () => {
            try { const result = projection(await authRequest<Health>('/platform/system-health')); if (current(token)) setHealth(result) }
            catch (failure) { if (current(token)) { if (accessDenied(failure)) invalidate(); else setError(`${safeAuthMessage(failure)} Operational status is unknown; a failed request does not prove the backend is unhealthy.`) } }
          })(),
          (async () => {
            try { const result = await authRequest<{ status: string }>('/health/live'); if (current(token)) setLive(result?.status === 'ok' ? 'responding' : 'unknown') }
            catch { if (current(token)) setLive('unknown') }
          })(),
        ])
      } catch (failure) { if (current(token)) { if (accessDenied(failure)) invalidate(); else setError(safeAuthMessage(failure)) } }
      finally { if (current(token)) setLoading(false) }
    })()
    return () => { begin() }
  }, [begin, current, invalidate, online, revision])
  useEffect(() => { if (!loading && focusResult.current) { focusResult.current = false; revealFocus(heading.current) } }, [loading])
  return <section className="platform-admin" aria-labelledby="system-health-heading">
    <header className="system-health-heading"><div><p className="eyebrow">sage.dev · Aggregate data only</p><h1 id="system-health-heading" ref={heading} tabIndex={-1}>System health</h1></div><Button disabled={loading || !online} onClick={() => { focusResult.current = true; setRevision(value => value + 1) }}>Refresh</Button></header>
    {!online && <ErrorSummary message="Connect to the internet to view system health." />}
    {online && loading && <LoadingState label="Checking access and operations…" />}
    {online && error && <ErrorSummary message={error} />}
    {online && verified && <>
      <div className="platform-health-grid"><article><h2>Liveness</h2><p>{live === 'responding' ? 'Responding' : live === 'unknown' ? 'Unknown — probe unavailable' : 'Checking…'}</p><p>The public liveness response does not assess database, queue or scheduler readiness.</p></article><article><h2>Readiness</h2><p>Readiness is unavailable in this workspace. It requires separate operational probe access.</p></article></div>
      {health && <><p role="status"><StatusBadge tone={health.status === 'healthy' ? 'success' : 'warning'}>{health.status === 'healthy' ? 'Healthy' : 'Degraded'}</StatusBadge></p>
        <p>Server-reported operational status. Checked <time dateTime={health.checked_at}>{time(health.checked_at)}</time>.</p>
        <div className="platform-health-grid">
          <article><h2>API and database</h2><p>{label(health.api.status)} · {health.database.size_bytes.toLocaleString()} bytes</p><p>24-hour growth: {health.database.growth_bytes_24h === null ? 'baseline pending' : `${health.database.growth_bytes_24h.toLocaleString()} bytes`}</p></article>
          <article><h2>Queue</h2><p>{label(health.queue.status)}</p><p>{health.queue.pending_count} pending · {health.queue.failed_24h} failed</p><p>Failures cover the previous 24 hours.</p><p>Oldest wait: {health.queue.oldest_age_seconds} seconds</p></article>
          <article><h2>Scheduler</h2><p>{label(health.scheduler.status)}</p><p>Last run: {time(health.scheduler.last_run_at)}</p></article>
          <article><h2>Birthday delivery</h2><p>{label(health.birthdays.status)} · {health.birthdays.failed_24h} failed in 24 hours</p><p>Last dispatch: {time(health.birthdays.last_dispatch_at)}</p></article>
          <article><h2>Synchronization</h2><p>{label(health.synchronization.status)}</p><p>Previous 24 hours: {health.synchronization.rejected_24h} rejected of {health.synchronization.events_24h}</p><p>{health.synchronization.open_conflicts} current open conflicts · {(health.synchronization.error_rate * 100).toFixed(1)}% 24-hour error rate</p></article>
        </div><p>Aggregate operational counts only. Use correlation references for incident investigation.</p>
      </>}
    </>}
  </section>
}
