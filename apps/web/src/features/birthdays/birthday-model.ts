import type { components } from '../../api/generated'

export type BirthdayProjection=components['schemas']['BirthdayProjection']
export function churchDate(timezone:string,now=new Date()):string {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
  return ['year','month','day'].map(type=>parts.find(part=>part.type===type)?.value).join('-')
}
export function birthdayProjection(value:BirthdayProjection,role:'owner'|'teacher'):BirthdayProjection {
  if(!value||value.role!==role||typeof value.timezone!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.local_date)||!Number.isFinite(Date.parse(value.local_date+'T00:00:00Z'))||new Date(value.local_date+'T00:00:00Z').toISOString().slice(0,10)!==value.local_date||!Number.isSafeInteger(value.count)||value.count<0||!Array.isArray(value.birthdays)||value.count!==value.birthdays.length||new Set(value.birthdays.map(row=>row?.id)).size!==value.count)throw Error('Birthday projection unavailable')
  churchDate(value.timezone) // Verify the returned timezone without replacing the authoritative server date with the device clock.
  const birthdays=value.birthdays.map(row=>{
    if(typeof row.id!=='string'||!row.id||typeof row.display_name!=='string'||!row.display_name||!Number.isSafeInteger(row.turning_age)||row.turning_age<0||!Array.isArray(row.ministry_names)||!row.ministry_names.every(name=>typeof name==='string'))throw Error('Birthday projection unavailable')
    return {id:row.id,display_name:row.display_name,turning_age:row.turning_age,ministry_names:row.ministry_names}
  })
  return {role,timezone:value.timezone,local_date:value.local_date,count:value.count,birthdays}
}
