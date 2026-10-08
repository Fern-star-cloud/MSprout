import { useCallback, useEffect, useState } from 'react'
import { useWorkspaceChurchId } from '../../app/workspace-context'
import type { components } from '../../api/generated'
import { authRequest, safeAuthMessage } from '../auth/transport'
import { avatarForGender } from './avatar'

type Student = components['schemas']['Student']
type Ministry = components['schemas']['Ministry']

export function StudentsScreen() {
  const church = useWorkspaceChurchId(new URLSearchParams(location.search).get('church') ?? '')
  const [students, setStudents] = useState<Student[]>([])
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [owner, setOwner] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const load = useCallback(async () => {
    try {
      const me = await authRequest<components['schemas']['ChurchAccount']>('/api/me', 'GET', undefined, church)
      const allowed = me.memberships.some(item => item.church_id === church && item.status === 'active' && item.role === 'owner') && me.active_session.mfa_confirmed
      setOwner(allowed)
      const [roster, ministryList] = await Promise.all([
        authRequest<{data: Student[]}>(`/api/students${allowed && includeArchived ? '?include_archived=true' : ''}`, 'GET', undefined, church),
        authRequest<{data: Ministry[]}>('/api/ministries', 'GET', undefined, church),
      ])
      setStudents(roster.data); setMinistries(ministryList.data); setError('')
    } catch (failure) { setStudents([]); setMinistries([]); setError(safeAuthMessage(failure)) }
  }, [church, includeArchived])
  useEffect(() => {
    if (!church) return
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [church, load, revision])

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form)
    const data = {first_name: String(fields.get('first_name')), middle_name: String(fields.get('middle_name') || '') || null,
      last_name: String(fields.get('last_name')), preferred_name: String(fields.get('preferred_name') || '') || null,
      suffix: String(fields.get('suffix') || '') || null, date_of_birth: String(fields.get('date_of_birth') || '') || null,
      gender: String(fields.get('gender')), external_reference: String(fields.get('external_reference') || '') || null,
      ministry_ids: fields.getAll('ministry_ids').map(String)}
    try { await authRequest('/api/students', 'POST', data, church); form.reset(); setRevision(value => value + 1) }
    catch (failure) { setError(safeAuthMessage(failure)) }
  }
  async function change(student: Student, status: 'archive' | 'restore') {
    try { await authRequest(`/api/students/${student.id}/${status}`, 'POST', undefined, church); setRevision(value => value + 1) }
    catch (failure) { setError(safeAuthMessage(failure)) }
  }
  async function update(event: React.FormEvent<HTMLFormElement>, student: Student) {
    event.preventDefault(); const fields = new FormData(event.currentTarget)
    const data = {first_name: String(fields.get('first_name')), middle_name: String(fields.get('middle_name') || '') || null,
      last_name: String(fields.get('last_name')), preferred_name: String(fields.get('preferred_name') || '') || null,
      suffix: String(fields.get('suffix') || '') || null, date_of_birth: String(fields.get('date_of_birth') || '') || null,
      gender: String(fields.get('gender')), external_reference: String(fields.get('external_reference') || '') || null,
      ministry_ids: fields.getAll('ministry_ids').map(String)}
    try { await authRequest(`/api/students/${student.id}`, 'PUT', data, church); setRevision(value => value + 1) }
    catch (failure) { setError(safeAuthMessage(failure)) }
  }
  return <section className="auth-card roster-card" aria-labelledby="students-heading">
    <p className="eyebrow">Church workspace · Online only</p><h2 id="students-heading">Students</h2>
    {error && <p role="alert">{error}</p>}
    {owner && <label className="archive-toggle"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} /> Show archived students</label>}
    {owner && <form className="roster-form student-form" aria-label="Add student" onSubmit={event => void create(event)}>
      <h3>Add student</h3><label>First name<input name="first_name" maxLength={120} required /></label><label>Middle name<input name="middle_name" maxLength={120} /></label>
      <label>Last name<input name="last_name" maxLength={120} required /></label><label>Preferred name<input name="preferred_name" maxLength={120} /></label>
      <label>Suffix<input name="suffix" maxLength={40} /></label><label>Birthdate<input name="date_of_birth" type="date" max={new Date().toISOString().slice(0, 10)} /></label>
      <label>Gender<select name="gender" defaultValue="unspecified"><option value="unspecified">Unspecified</option><option value="female">Female</option><option value="male">Male</option></select></label>
      <label>External reference<input name="external_reference" maxLength={120} /></label>
      <fieldset><legend>Enroll in ministries</legend>{ministries.map(item => <label className="roster-check" key={item.id}><input type="checkbox" name="ministry_ids" value={item.id} />{item.name}</label>)}</fieldset>
      <button>Add student</button>
    </form>}
    <ul className="roster-list student-list">{students.map(student => <li key={student.id}>
      <img className="student-avatar" src={avatarForGender(student.gender)} alt="" />
      <div><strong>{student.display_name}</strong><small>{student.ministry_ids.map(id => ministries.find(item => item.id === id)?.name).filter(Boolean).join(', ') || 'No ministry'}</small>
        {'date_of_birth' in student && student.date_of_birth && <small>Birthday: {student.date_of_birth}</small>}
        {'birth_month_day' in student && student.birth_month_day && <small>Birthday: {student.birth_month_day}</small>}
      </div>
      {owner && <><details><summary>Edit</summary><form className="roster-form edit-student-form" onSubmit={event => void update(event, student)}>
        <label>First name<input name="first_name" defaultValue={student.first_name} maxLength={120} required /></label><label>Middle name<input name="middle_name" defaultValue={student.middle_name ?? ''} maxLength={120} /></label>
        <label>Last name<input name="last_name" defaultValue={student.last_name} maxLength={120} required /></label><label>Preferred name<input name="preferred_name" defaultValue={student.preferred_name ?? ''} maxLength={120} /></label>
        <label>Suffix<input name="suffix" defaultValue={student.suffix ?? ''} maxLength={40} /></label><label>Birthdate<input name="date_of_birth" type="date" defaultValue={student.date_of_birth ?? ''} max={new Date().toISOString().slice(0, 10)} /></label>
        <label>Gender<select name="gender" defaultValue={student.gender}><option value="unspecified">Unspecified</option><option value="female">Female</option><option value="male">Male</option></select></label>
        <label>External reference<input name="external_reference" defaultValue={student.external_reference ?? ''} maxLength={120} /></label>
        <fieldset><legend>Ministries</legend>{ministries.map(item => <label className="roster-check" key={item.id}><input type="checkbox" name="ministry_ids" value={item.id} defaultChecked={student.ministry_ids.includes(item.id)} />{item.name}</label>)}</fieldset><button>Save student</button>
      </form></details><button className="secondary" onClick={() => void change(student, student.status === 'active' ? 'archive' : 'restore')}>{student.status === 'active' ? 'Archive' : 'Restore'}</button></>}
    </li>)}</ul>
    <a href={`/ministries${church ? `?church=${encodeURIComponent(church)}` : ''}`}>Manage ministries</a>{owner && <> · <a href={`/imports${church ? `?church=${encodeURIComponent(church)}` : ''}`}>Import students</a></>}
  </section>
}
