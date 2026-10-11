import { useEffect } from 'react'
import type { components } from '../../api/generated'

export type AttendanceReportSession = components['schemas']['AttendanceReportSession']

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })

function correctionLink(session: AttendanceReportSession) {
  if (session.correction_count === 0) return <span>None</span>
  const label = `${session.correction_count} correction${session.correction_count === 1 ? '' : 's'}`
  return <a href={`#history-session-${session.id}`} onClick={()=>openSession(`history-session-${session.id}`)}>{label}</a>
}

function openSession(id:string){
  const target=document.getElementById(id)
  if(!(target instanceof HTMLDetailsElement))return
  target.open=true
  target.querySelector('summary')?.focus()
}

export function AttendanceHistory({ sessions, teacher = false }: { sessions: AttendanceReportSession[]; teacher?: boolean }) {
  useEffect(()=>{const open=()=>openSession(location.hash.slice(1));open();window.addEventListener('hashchange',open);return()=>window.removeEventListener('hashchange',open)},[sessions])
  return <section className="attendance-history" id="history" aria-labelledby="history-heading">
    <header>
      <div><p className="eyebrow">Attendance history</p><h2 id="history-heading">{teacher ? 'Assigned recent sessions' : 'Finalized sessions'}</h2></div>
      <p>Finalized server attendance only. Original attendance stays immutable; corrections append revisions. Up to 100 recent sessions are returned; this list is not complete history or a source for aggregate totals.</p>
    </header>
    {sessions.length === 0 && <p>No finalized sessions match these filters.</p>}
    {sessions.length > 0 && <>
      <div className="history-table-wrap" role="region" aria-label="Recent finalized sessions table" tabIndex={0}>
        <table className="history-table">
          <caption>Recorded dates and revision-effective attendance · {sessions.length} returned sessions</caption>
          <thead><tr>{['Date','Ministry','Recorded status','Present','Absent','Rate','Corrections'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
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
      <div className="history-records">{sessions.map(session=><details key={session.id} id={`history-session-${session.id}`}>
        <summary>Recorded session · {session.attendance_date} · {session.ministry_name}</summary>
        <dl>
          <div><dt>Session reference</dt><dd>{session.id}</dd></div>
          <div><dt>Recorded attendance date</dt><dd><time dateTime={session.attendance_date}>{session.attendance_date}</time></dd></div>
          <div><dt>Finalized at (UTC source)</dt><dd><time dateTime={session.finalized_at}>{session.finalized_at}</time></dd></div>
          <div><dt>Recorded status</dt><dd>{session.status==='revised'?'Revised':'Finalized'}</dd></div>
          <div><dt>Effective attendance</dt><dd>{session.present_count} Present · {session.absent_count} Absent · {percent.format(session.attendance_rate)}</dd></div>
          <div><dt>Append-only revision count</dt><dd>{session.correction_count}</dd></div>
        </dl>
        <p>These are the session fields returned by the report. Individual revision entries and student-level attendance detail are unavailable through this report API. No edit or correction action is provided here.</p>
        <p>Server-finalized history does not prove that other device work has synchronized. Review state is shown only through returned counts and recorded status.</p>
      </details>)}</div>
    </>}
  </section>
}
