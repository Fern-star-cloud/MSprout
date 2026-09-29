import type { components } from '../../api/generated'

export type AttendanceReportSession = components['schemas']['AttendanceReportSession']

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })

function correctionLink(session: AttendanceReportSession) {
  if (session.correction_count === 0) return <span>None</span>
  const label = `${session.correction_count} correction${session.correction_count === 1 ? '' : 's'}`
  return <a href={`/account/reports?session=${encodeURIComponent(session.id)}#history`}>{label}</a>
}

export function AttendanceHistory({ sessions, teacher = false }: { sessions: AttendanceReportSession[]; teacher?: boolean }) {
  return <section className="attendance-history" id="history" aria-labelledby="history-heading">
    <header>
      <div><p className="eyebrow">Attendance history</p><h2 id="history-heading">{teacher ? 'Assigned recent sessions' : 'Finalized sessions'}</h2></div>
      <p>Finalized server attendance only. Corrections remain linked to immutable history.</p>
    </header>
    {sessions.length === 0 && <p>No finalized sessions match these filters.</p>}
    {sessions.length > 0 && <>
      <div className="history-table-wrap">
        <table className="history-table">
          <thead><tr><th>Date</th><th>Ministry</th><th>Status</th><th>Present</th><th>Absent</th><th>Rate</th><th>Corrections</th></tr></thead>
          <tbody>{sessions.map((session) => <tr key={session.id}>
            <td><time dateTime={session.attendance_date}>{session.attendance_date}</time></td>
            <td>{session.ministry_name}</td><td>{session.status === 'revised' ? 'Revised' : 'Finalized'}</td>
            <td>{session.present_count}</td><td>{session.absent_count}</td><td>{percent.format(session.attendance_rate)}</td>
            <td>{correctionLink(session)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="history-cards">{sessions.map((session) => <article key={session.id}>
        <div><time dateTime={session.attendance_date}>{session.attendance_date}</time><strong>{session.ministry_name}</strong></div>
        <dl>
          <div><dt>Present</dt><dd>{session.present_count}</dd></div>
          <div><dt>Absent</dt><dd>{session.absent_count}</dd></div>
          <div><dt>Rate</dt><dd>{percent.format(session.attendance_rate)}</dd></div>
          <div><dt>Status</dt><dd>{session.status === 'revised' ? 'Revised' : 'Finalized'}</dd></div>
        </dl>
        <p>{correctionLink(session)}</p>
      </article>)}</div>
    </>}
  </section>
}
