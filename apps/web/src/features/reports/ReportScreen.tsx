import { useCallback, useEffect, useState } from 'react'
import type { components } from '../../api/generated'
import { AttendanceHistory } from '../history/AttendanceHistory'
import { pendingLocalAttendanceCount } from '../history/pending-local'
import { authDownload, authRequest, safeAuthMessage } from '../auth/transport'

type AttendanceReport = components['schemas']['AttendanceReport']
interface MinistryOption { id: string; name: string }

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function defaultFrom(): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - 30)
  return isoDate(date)
}

function reportPath(base: '/api/attendance-reports' | '/api/attendance-reports/export', from: string, to: string, ministryId: string): string {
  const query = new URLSearchParams({ date_from: from, date_to: to })
  if (ministryId) query.set('ministry_id', ministryId)
  return `${base}?${query.toString()}`
}

export function ReportScreen({
  initialChurchId = new URLSearchParams(globalThis.location?.search ?? '').get('church') ?? '',
  initialFrom = defaultFrom(), initialTo = isoDate(new Date()),
  pendingLocalCount = pendingLocalAttendanceCount,
}: {
  initialChurchId?: string
  initialFrom?: string
  initialTo?: string
  pendingLocalCount?: (churchId: string) => Promise<number>
}) {
  const [churchId, setChurchId] = useState(initialChurchId)
  const [workspace, setWorkspace] = useState(initialChurchId)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [ministryId, setMinistryId] = useState('')
  const [applied, setApplied] = useState({ from: initialFrom, to: initialTo, ministryId: '' })
  const [ministries, setMinistries] = useState<MinistryOption[]>([])
  const [report, setReport] = useState<AttendanceReport | null>(null)
  const [localPending, setLocalPending] = useState(0)
  const [loading, setLoading] = useState(Boolean(initialChurchId))
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!churchId) return
    setLoading(true)
    try {
      const [reportResponse, ministryResponse, pending] = await Promise.all([
        authRequest<{ data: AttendanceReport }>(reportPath('/api/attendance-reports', applied.from, applied.to, applied.ministryId), 'GET', undefined, churchId),
        authRequest<{ data: MinistryOption[] }>('/api/ministries', 'GET', undefined, churchId),
        pendingLocalCount(churchId),
      ])
      setReport(reportResponse.data)
      setMinistries(ministryResponse.data)
      setLocalPending(pending)
      setError('')
    } catch (failure) {
      setReport(null)
      setMinistries([])
      setLocalPending(0)
      setError(safeAuthMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [applied, churchId, pendingLocalCount])

  useEffect(() => {
    const timer = globalThis.setTimeout(() => { void load() }, 0)
    return () => globalThis.clearTimeout(timer)
  }, [load])

  async function download() {
    if (!report?.can_export) return
    setDownloading(true)
    try {
      const blob = await authDownload(reportPath('/api/attendance-reports/export', applied.from, applied.to, applied.ministryId), churchId)
      const url = globalThis.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `attendance-${applied.from}-to-${applied.to}.csv`
      anchor.click()
      globalThis.URL.revokeObjectURL(url)
      setError('')
    } catch (failure) {
      setError(safeAuthMessage(failure))
    } finally {
      setDownloading(false)
    }
  }

  return <section className="report-screen" aria-labelledby="report-heading">
    <header className="report-heading">
      <div><p className="eyebrow">Church workspace · Online only</p><h1 id="report-heading">Attendance reports</h1></div>
      {report?.can_export && <button type="button" disabled={downloading} onClick={() => void download()}>{downloading ? 'Preparing CSV…' : 'Download CSV'}</button>}
    </header>
    {!churchId && <form className="report-workspace" onSubmit={(event) => { event.preventDefault(); setChurchId(workspace) }}>
      <label htmlFor="report-church">Church workspace ID</label>
      <input id="report-church" required value={workspace} onChange={(event) => setWorkspace(event.target.value)} />
      <button>Open reports</button>
    </form>}
    {churchId && <form className="report-filters" onSubmit={(event) => {
      event.preventDefault()
      setApplied({ from, to, ministryId })
    }}>
      <label>From<input type="date" required value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>To<input type="date" required value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
      <label>Ministry<select value={ministryId} onChange={(event) => setMinistryId(event.target.value)}><option value="">All permitted ministries</option>{ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label>
      <button>Apply filters</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading attendance report…</p>}
    {report && <>
      <div className="report-summary" aria-label="Attendance summary">
        <article><span>Present</span><strong>{report.summary.present_count}</strong></article>
        <article><span>Absent</span><strong>{report.summary.absent_count}</strong></article>
        <article><span>Attendance rate</span><strong>{percent.format(report.summary.attendance_rate)}</strong></article>
        <article><span>Pending on server</span><strong>{report.summary.pending_count}</strong></article>
      </div>
      <div className="report-status-links">
        <span>{localPending} local event{localPending === 1 ? '' : 's'}</span>
        <a href={`/account/conflicts?church=${encodeURIComponent(churchId)}`}>{report.summary.conflict_count} conflict{report.summary.conflict_count === 1 ? '' : 's'}</a>
        <a href={`/account/reports?church=${encodeURIComponent(churchId)}#history`}>{report.summary.correction_count} correction{report.summary.correction_count === 1 ? '' : 's'}</a>
      </div>
      <p className="report-boundary">Pending device work and unresolved conflicts are not counted as finalized attendance.</p>
      <AttendanceHistory sessions={report.sessions} teacher={report.role === 'teacher'} />
    </>}
  </section>
}
