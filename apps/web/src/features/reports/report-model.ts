import type { components } from '../../api/generated'

export type AttendanceReport = components['schemas']['AttendanceReport']
export type Filters = { from:string; to:string; ministryId:string }
export type MinistryOption = { id:string; name:string; status:'active'|'archived' }
export const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null
const count=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0
const rate=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1
export function dateStamp(value:string):number|null {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null
  const stamp=Date.parse(value+'T00:00:00Z')
  return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp:null
}
export function validFilters(filters:Filters):boolean {
  const from=dateStamp(filters.from),to=dateStamp(filters.to)
  return from!==null&&to!==null&&to>=from&&(to-from)/86400000<=366&&(!filters.ministryId||uuid(filters.ministryId))
}
export function defaultFilters(now=new Date()):Filters {
  const from=new Date(now);from.setUTCDate(from.getUTCDate()-30)
  return{from:from.toISOString().slice(0,10),to:now.toISOString().slice(0,10),ministryId:''}
}
export function reportPath(exporting:boolean,filters:Filters):string {
  const query=new URLSearchParams({date_from:filters.from,date_to:filters.to})
  if(filters.ministryId)query.set('ministry_id',filters.ministryId)
  return `/api/attendance-reports${exporting?'/export':''}?${query}`
}
export function ministries(value:unknown):MinistryOption[] {
  if(!object(value)||!Array.isArray(value.data)||!value.data.every(row=>object(row)&&uuid(row.id)&&typeof row.name==='string'&&row.name.length>0&&['active','archived'].includes(String(row.status)))||new Set(value.data.map(row=>row.id)).size!==value.data.length)throw Error('Invalid ministry response')
  return value.data.map(row=>({id:row.id,name:row.name,status:row.status}))
}
export function validReport(value:unknown,filters:Filters,role:'owner'|'teacher',assignments:string[]):value is AttendanceReport {
  if(!object(value)||value.role!==role||typeof value.can_export!=='boolean'||role==='teacher'&&value.can_export||!object(value.filters)||value.filters.date_from!==filters.from||value.filters.date_to!==filters.to||value.filters.ministry_id!==(filters.ministryId||null)||!object(value.summary)||!Array.isArray(value.sessions)||value.sessions.length>100)return false
  const summary=value.summary
  if(!['present_count','absent_count','finalized_record_count','pending_count','conflict_count','correction_count'].every(key=>count(summary[key]))||!rate(summary.attendance_rate)||summary.finalized_record_count!==Number(summary.present_count)+Number(summary.absent_count))return false
  return new Set(value.sessions.map(row=>row?.id)).size===value.sessions.length&&value.sessions.every(row=>object(row)&&uuid(row.id)&&uuid(row.ministry_id)&&typeof row.ministry_name==='string'&&row.ministry_name.length>0&&typeof row.attendance_date==='string'&&dateStamp(row.attendance_date)!==null&&row.attendance_date>=filters.from&&row.attendance_date<=filters.to&&(!filters.ministryId||row.ministry_id===filters.ministryId)&&['finalized','revised'].includes(String(row.status))&&typeof row.finalized_at==='string'&&Number.isFinite(Date.parse(row.finalized_at))&&['present_count','absent_count','correction_count'].every(key=>count(row[key]))&&rate(row.attendance_rate)&&(role==='owner'||assignments.includes(row.ministry_id)))
}
