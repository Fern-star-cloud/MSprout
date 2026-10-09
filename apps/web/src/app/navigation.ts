import type { RouteId } from './routes'
export interface NavigationItem { id: RouteId; label: string; href: string; group?: 'People' }
const item = (id: RouteId, label: string, group?: 'People'): NavigationItem => ({ id, label, href: id === 'account' ? '/account' : `/account/${id}`, group })
const home = item('home', 'Home'), attendance = item('attendance', 'Attendance'), sync = item('sync', 'Sync & device'), account = item('account', 'Account'), more = item('more', 'More')
const ownerPeople = [item('students', 'Students', 'People'), item('ministries', 'Ministries', 'People'), item('teachers', 'Teachers', 'People'), item('imports', 'Import', 'People')]
export function navigationFor(role: 'owner' | 'teacher' | null) {
  const supporting = role === 'owner'
    ? [item('reports', 'Reports'), item('birthdays', 'Birthdays'), item('audit', 'Church activity')]
    : role === 'teacher' ? [item('ministries', 'My ministries'), item('students', 'Assigned roster'), item('reports', 'Recent sessions'), item('birthdays', 'Birthdays'), item('audit', 'My activity')] : []
  const people = item('people', 'People'), review = item('conflicts', 'Review')
  return {
    main: [home, attendance, ...(role === 'owner' ? [people, ...ownerPeople, review] : []), ...supporting, sync, account],
    phone: role === 'owner' ? [home, attendance, review, people, more] : [home, attendance, item('sync', 'Sync'), more],
    more: [...supporting, sync, item('profiles', 'Device profiles'), item('prepare', 'Prepare this device'), account],
    people: role === 'owner' ? ownerPeople : [],
  }
}
