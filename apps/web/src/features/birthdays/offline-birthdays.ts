import { profileStore } from '../../offline/profile-store'

interface BirthdayRosterEntry {
  id: string
  display_name: string
  next_birthday_month_day: string | null
  turning_age: number | null
  ministry_ids: string[]
}

interface OfflineBirthdayStore {
  activeProfile(): Promise<{ id: string; churchId: string | null } | null>
  readEncryptedRoster<T>(profileId: string): Promise<T>
  readEncryptedMinistries<T>(profileId: string): Promise<T>
  readEncryptedAuthorization<T>(profileId: string): Promise<T>
}

function localDateParts(date: Date, timezone: string): { year: number; monthDay: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''

  return { year: Number(value('year')), monthDay: `${value('month')}-${value('day')}` }
}

export function birthdayMonthDayMatches(monthDay: string | null, today: string, year: number): boolean {
  if (monthDay === today) return true
  const leapYear = new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29
  return monthDay === '02-29' && today === '02-28' && !leapYear
}

export async function loadOfflineBirthdays(
  churchId: string,
  store: OfflineBirthdayStore = profileStore,
  now = new Date(),
) {
  const profile = await store.activeProfile()
  if (!profile || profile.churchId !== churchId) return null
  const authorization = await store.readEncryptedAuthorization<{ timezone?: string }>(profile.id)
  if (!authorization.timezone) return null
  const [{ year, monthDay }, roster, ministries] = await Promise.all([
    Promise.resolve(localDateParts(now, authorization.timezone)),
    store.readEncryptedRoster<BirthdayRosterEntry[]>(profile.id),
    store.readEncryptedMinistries<Array<{ id: string; name: string }>>(profile.id),
  ])
  const ministryNames = new Map(ministries.map((ministry) => [ministry.id, ministry.name]))
  const birthdays = roster.filter((student) => birthdayMonthDayMatches(student.next_birthday_month_day, monthDay, year))
    .map((student) => ({
      id: student.id,
      display_name: student.display_name,
      turning_age: student.turning_age ?? 0,
      ministry_names: student.ministry_ids.map((id) => ministryNames.get(id)).filter((name): name is string => Boolean(name)),
    }))

  return {
    local_date: `${year}-${monthDay}`, timezone: authorization.timezone, role: 'teacher' as const,
    count: birthdays.length, birthdays,
  }
}
