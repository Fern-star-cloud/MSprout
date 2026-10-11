import { useContext, useEffect, useRef, useState } from 'react'
import { ChurchWorkspaceContext, useWorkspaceChurchId } from '../../app/workspace-context'
import { Button, ErrorSummary, LoadingState, StatusBanner } from '../../components/ui/Foundations'
import { AttendanceHistory } from '../history/AttendanceHistory'
import { pendingLocalAttendanceCount } from '../history/pending-local'
import { defaultFilters, validFilters, type Filters } from './report-model'
import { useAttendanceReport, type PendingCount } from './useAttendanceReport'
import './reports.css'

const percent=new Intl.NumberFormat(undefined,{style:'percent',maximumFractionDigits:1})
export function ReportScreen({initialChurchId=new URLSearchParams(globalThis.location?.search??'').get('church')??'',initialFrom=defaultFilters().from,initialTo=defaultFilters().to,pendingLocalCount=pendingLocalAttendanceCount}:{initialChurchId?:string;initialFrom?:string;initialTo?:string;pendingLocalCount?:PendingCount}){
  const church=useWorkspaceChurchId(initialChurchId),workspace=useContext(ChurchWorkspaceContext)
  return <ScopedReports key={`${church}:${workspace?.role??''}`} church={church} initial={{from:initialFrom,to:initialTo,ministryId:''}} pendingCount={pendingLocalCount}/>
}
function ScopedReports({church,initial,pendingCount}:{church:string;initial:Filters;pendingCount:PendingCount}){
  const [draft,setDraft]=useState(initial),[validation,setValidation]=useState(''),report=useAttendanceReport(church,initial,pendingCount),error=useRef<HTMLDivElement>(null),pointer=useRef(false)
  const data=report.report,changed=draft.from!==report.applied.from||draft.to!==report.applied.to||draft.ministryId!==report.applied.ministryId
  useEffect(()=>{if(validation||report.error)error.current?.focus()},[validation,report.error])
  useEffect(()=>{const keyboard=()=>{pointer.current=false};window.addEventListener('keydown',keyboard,true);return()=>window.removeEventListener('keydown',keyboard,true)},[])
  const fields=report.fields.map(field=>({target:`report-${field}`,message:`Check ${field==='date_from'?'the From date':field==='date_to'?'the To date':'the Ministry'}.`}))
  return <section className="report-screen" aria-labelledby="report-heading"
    onPointerDownCapture={()=>{pointer.current=true}} onPointerUpCapture={()=>{pointer.current=false}} onPointerCancelCapture={()=>{pointer.current=false}} onKeyDownCapture={()=>{pointer.current=false}}
    onFocusCapture={event=>{
      const target=event.target;if(pointer.current)return
      const ensureVisible=()=>{if(!target.isConnected||document.activeElement!==target)return;const rect=target.getBoundingClientRect(),navigation=document.querySelector('.phone-navigation')?.getBoundingClientRect();if(rect.top<4||rect.bottom>(navigation?.height?navigation.top:innerHeight)-4)target.scrollIntoView?.({block:'start',inline:'nearest'})}
      queueMicrotask(ensureVisible);globalThis.requestAnimationFrame?.(ensureVisible)
    }}>
    <header className="report-heading"><div><p className="eyebrow">Church workspace · Online only</p><h1 id="report-heading">Attendance reports</h1></div>{data?.can_export&&<Button busy={report.downloading} onClick={()=>void report.download()}>{report.downloading?'Preparing CSV…':'Download CSV'}</Button>}</header>
    <p>Authoritative finalized attendance and recorded session history. No report action changes attendance.</p>
    {church&&<form className="report-filters" aria-describedby="report-date-help" onSubmit={event=>{event.preventDefault();if(!validFilters(draft)){setValidation('Choose valid dates in order, no more than 366 days apart.');return}setValidation('');void report.load({...draft})}}>
      <label htmlFor="report-date_from">From<input id="report-date_from" type="date" required value={draft.from} max={draft.to} disabled={report.downloading} aria-invalid={report.fields.includes('date_from')||undefined} onChange={event=>setDraft(value=>({...value,from:event.target.value}))}/></label>
      <label htmlFor="report-date_to">To<input id="report-date_to" type="date" required value={draft.to} min={draft.from} disabled={report.downloading} aria-invalid={report.fields.includes('date_to')||undefined} onChange={event=>setDraft(value=>({...value,to:event.target.value}))}/></label>
      <label htmlFor="report-ministry_id">Ministry<select id="report-ministry_id" value={draft.ministryId} disabled={report.downloading||report.phase==='loading'} aria-invalid={report.fields.includes('ministry_id')||undefined} onChange={event=>setDraft(value=>({...value,ministryId:event.target.value}))}><option value="">All permitted ministries</option>{data&&draft.ministryId&&!report.options.some(row=>row.id===draft.ministryId)&&<option value={draft.ministryId}>Selected ministry (not in current choices)</option>}{report.options.map(ministry=><option key={ministry.id} value={ministry.id}>{ministry.name}{ministry.status==='archived'?' (archived)':''}</option>)}</select></label>
      <Button type="submit" disabled={report.phase==='loading'||report.phase==='offline'} busy={report.downloading}>Apply filters</Button>
      <p id="report-date-help">Both recorded-date boundaries are included; the server accepts dates up to 366 days apart. Defaults use UTC. Recorded attendance dates are not converted to your device timezone.</p>
    </form>}
    {(validation||report.error)&&<ErrorSummary ref={error} message={validation||report.error} errors={validation?[{target:'report-date_from',message:'Check the date range.'}]:fields}/>}
    {report.phase==='loading'&&<LoadingState label="Checking access and loading attendance report…"/>}
    {report.phase==='offline'&&<StatusBanner>Reports require a verified online session. Local attendance is preserved; reconnect to read the server report.</StatusBanner>}
    {report.phase==='error'&&<Button variant="secondary" onClick={()=>void report.load(report.applied)}>Retry report</Button>}
    {changed&&<StatusBanner>Unapplied changes. Totals, history and CSV use the applied filters until you choose Apply filters.</StatusBanner>}
    {report.exportNotice&&<StatusBanner live>{report.exportNotice}</StatusBanner>}
    {data&&<>
      <section className="report-applied" aria-labelledby="report-applied-heading"><h2 id="report-applied-heading">Applied report</h2><p><time dateTime={data.filters.date_from}>{data.filters.date_from}</time> through <time dateTime={data.filters.date_to}>{data.filters.date_to}</time> · {data.filters.ministry_id?(report.options.find(row=>row.id===data.filters.ministry_id)?.name??'Selected authorized ministry'):'All permitted ministries'}</p><p>{data.role==='teacher'?'Only currently assigned ministries are included.':'Only this verified church is included.'} Ministry choices are the returned authorized list; historical totals can include archived ministries.</p></section>
      <section aria-labelledby="report-totals-heading"><h2 id="report-totals-heading">Finalized attendance totals</h2><dl className="report-summary">{[['Present',data.summary.present_count],['Absent',data.summary.absent_count],['Finalized records',data.summary.finalized_record_count],['Attendance rate',percent.format(data.summary.attendance_rate)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>These server totals cover the applied range. They are not calculated from the bounded recent-session list. Rate uses revision-effective Present divided by finalized Present plus Absent; the server returns 0% when there are no finalized records.</p></section>
      <section aria-labelledby="report-work-heading"><h2 id="report-work-heading">Work outside finalized totals</h2><dl className="report-work"><div><dt>Pending on server</dt><dd>{data.summary.pending_count} draft or finalized-pending sessions</dd></div><div><dt>Local device work</dt><dd>{report.local===null?'Local event count unavailable.':`${report.local} local event${report.local===1?'':'s'}`}</dd></div><div><dt>Needs Owner review</dt><dd><a href={`/account/conflicts?church=${encodeURIComponent(church)}`}>{data.summary.conflict_count} conflict{data.summary.conflict_count===1?'':'s'}</a>{data.role==='teacher'&&<p>Restricted notice only; competing values and Owner decisions are not shown.</p>}</dd></div><div><dt>Append-only revisions</dt><dd><a href="#history">{data.summary.correction_count} correction{data.summary.correction_count===1?'':'s'}</a></dd></div></dl><p className="report-boundary">Pending device work and unresolved conflicts are not counted as finalized attendance. Local events are for a matching unlocked, lease-valid profile across its dates, not this report range. This count does not establish completed synchronization.</p><a href="/sync">Sync &amp; device</a></section>
      <AttendanceHistory key={`${data.filters.date_from}:${data.filters.date_to}:${data.filters.ministry_id??''}`} sessions={data.sessions} teacher={data.role==='teacher'}/>
    </>}
  </section>
}
