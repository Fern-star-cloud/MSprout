import { useEffect, useState } from 'react'
import type { components } from '../../../api/generated'
import { authRequest, safeAuthMessage } from '../../auth/transport'

type SystemHealth = components['schemas']['SystemHealth']

const title = (status: string) => status === 'healthy' ? 'Healthy' : status === 'ok' ? 'Operational' : 'Needs attention'
const instant = (value: string | null) => value ? new Date(value).toLocaleString() : 'No activity recorded'

export function SystemHealthScreen() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); setHealth(null); setLoading(true) }
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    let active = true
    if (online) void authRequest<SystemHealth>('/platform/system-health')
      .then((result) => { if (active) { setHealth(result); setError('') } })
      .catch((failure) => { if (active) { setHealth(null); setError(safeAuthMessage(failure)) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [online, revision])

  return <section className="system-health" aria-labelledby="system-health-heading">
    <header className="system-health-heading">
      <div><p className="eyebrow">sage.dev · Aggregate data only</p><h1 id="system-health-heading">System health</h1></div>
      <button type="button" disabled={loading || !online} onClick={() => { setLoading(true); setRevision(value => value + 1) }}>Refresh</button>
    </header>
    {!online && <p role="alert">Connect to the internet to view system health.</p>}
    {online && loading && <p role="status">Checking operations…</p>}
    {online && error && <p role="alert">{error}</p>}
    {health && <>
      <p className={`health-overall health-${health.status}`} role="status">{title(health.status)}</p>
      <div className="health-grid">
        <article><h2>API and database</h2><p>{title(health.api.status)} · {health.database.size_bytes.toLocaleString()} bytes</p><small>24-hour growth: {health.database.growth_bytes_24h === null ? 'baseline pending' : `${health.database.growth_bytes_24h.toLocaleString()} bytes`}</small></article>
        <article><h2>Queue</h2><p>{health.queue.pending_count} pending · {health.queue.failed_24h} failed</p><small>Oldest wait: {health.queue.oldest_age_seconds} seconds</small></article>
        <article><h2>Scheduler</h2><p>{title(health.scheduler.status)}</p><small>Last run: {instant(health.scheduler.last_run_at)}</small></article>
        <article><h2>Birthday delivery</h2><p>{title(health.birthdays.status)} · {health.birthdays.failed_24h} failed in 24 hours</p><small>Last dispatch: {instant(health.birthdays.last_dispatch_at)}</small></article>
        <article><h2>Synchronization</h2><p>{health.synchronization.rejected_24h} rejected of {health.synchronization.events_24h}</p><small>{health.synchronization.open_conflicts} open conflicts · {(health.synchronization.error_rate * 100).toFixed(1)}% error rate</small></article>
      </div>
      <p className="health-boundary">This dashboard intentionally contains aggregate operational counts only. Use correlation IDs in logs and audit history for incident investigation.</p>
      <small>Checked {instant(health.checked_at)}</small>
    </>}
    <nav className="platform-links" aria-label="Platform administration"><a href="/account/platform-applications">Applications</a><a href="/account/platform-audit">Platform audit</a><a href="/account/platform-login">Platform account</a></nav>
  </section>
}
