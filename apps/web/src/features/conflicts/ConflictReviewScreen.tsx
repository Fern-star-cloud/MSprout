import { useCallback, useEffect, useState } from 'react'
import { authRequest, safeAuthMessage } from '../auth/transport'

interface ConflictSide {
  value: { state: 'present' | 'absent' }
  actor_id: string | number | null
  device_id: string | null
  local_time: string | null
  server_time: string | null
  correlation_id: string | null
}

interface AttendanceConflict {
  id: string
  session_id: string
  record_id: string
  field: 'state'
  base_version: number
  status: 'open'
  existing: ConflictSide
  incoming: ConflictSide
}

interface PendingGuest {
  id: string
  session_id: string
  display_name: string
  gender: 'male' | 'female' | 'unspecified'
  actor_id: string | number
  device_id: string
  local_time: string
  server_time: string
}

interface StudentOption { id: string; display_name: string }

type ConflictResponse = { data: AttendanceConflict[] } | { needs_owner_review: boolean }

function evidence(label: string, side: ConflictSide) {
  return <section className="conflict-side" aria-label={`${label} attendance value`}>
    <p className="eyebrow">{label}</p>
    <h3>{side.value.state === 'present' ? 'Present' : 'Absent'}</h3>
    <dl>
      <div><dt>Actor</dt><dd>{side.actor_id ?? 'Unknown'}</dd></div>
      <div><dt>Device</dt><dd>{side.device_id ?? 'Unknown'}</dd></div>
      <div><dt>Local time</dt><dd>{side.local_time ?? 'Unavailable'}</dd></div>
      <div><dt>Server time</dt><dd>{side.server_time ?? 'Unavailable'}</dd></div>
    </dl>
  </section>
}

export function ConflictReviewScreen({
  initialChurchId = new URLSearchParams(globalThis.location?.search ?? '').get('church') ?? '',
}: { initialChurchId?: string }) {
  const [churchId, setChurchId] = useState(initialChurchId)
  const [workspace, setWorkspace] = useState(initialChurchId)
  const [conflicts, setConflicts] = useState<AttendanceConflict[]>([])
  const [guests, setGuests] = useState<PendingGuest[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [teacherNotice, setTeacherNotice] = useState(false)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(initialChurchId))

  const load = useCallback(async () => {
    if (!churchId) return
    setLoading(true)
    try {
      const response = await authRequest<ConflictResponse>('/api/sync-conflicts', 'GET', undefined, churchId)
      if ('needs_owner_review' in response && typeof response.needs_owner_review === 'boolean') {
        setTeacherNotice(response.needs_owner_review)
        setConflicts([])
        setGuests([])
        setStudents([])
      } else if ('data' in response && Array.isArray(response.data)) {
        const [guestResponse, studentResponse] = await Promise.all([
          authRequest<{ data: PendingGuest[] }>('/api/attendance-guests', 'GET', undefined, churchId),
          authRequest<{ data: StudentOption[] }>('/api/students', 'GET', undefined, churchId),
        ])
        setTeacherNotice(false)
        setConflicts(response.data)
        setGuests(guestResponse.data)
        setStudents(studentResponse.data)
      } else {
        throw new Error('The review response is invalid.')
      }
      setError('')
    } catch (failure) {
      setConflicts([])
      setGuests([])
      setStudents([])
      setTeacherNotice(false)
      setError(safeAuthMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [churchId])

  useEffect(() => {
    const timer = globalThis.setTimeout(() => { void load() }, 0)
    return () => globalThis.clearTimeout(timer)
  }, [load])

  async function resolve(conflict: AttendanceConflict, choice: 'existing' | 'incoming') {
    const normalized = (reasons[conflict.id] ?? '').replace(/[\s\p{Z}]+/gu, ' ').trim()
    if (!normalized || normalized.length > 500) {
      setError('Enter a resolution reason of 500 characters or fewer.')
      return
    }
    try {
      await authRequest(`/api/sync-conflicts/${conflict.id}/resolve`, 'POST', { choice, reason: normalized }, churchId)
      setReasons((current) => {
        const next = { ...current }
        delete next[conflict.id]
        return next
      })
      await load()
    } catch (failure) {
      setError(safeAuthMessage(failure))
    }
  }

  async function resolveGuest(event: React.FormEvent<HTMLFormElement>, guest: PendingGuest, action: 'promote' | 'link' | 'merge') {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const body = action === 'promote'
      ? { first_name: String(fields.get('first_name')), last_name: String(fields.get('last_name')), gender: String(fields.get('gender')) }
      : action === 'link'
        ? { student_id: String(fields.get('student_id')) }
        : { guest_id: String(fields.get('guest_id')) }
    try {
      await authRequest(`/api/attendance-guests/${guest.id}/${action}`, 'POST', body, churchId)
      await load()
    } catch (failure) {
      setError(safeAuthMessage(failure))
    }
  }

  return <section className="auth-card conflict-review" aria-labelledby="conflict-heading">
    <p className="eyebrow">Church workspace · Online only</p>
    <h1 id="conflict-heading">Attendance review</h1>
    {!churchId && <form onSubmit={(event) => { event.preventDefault(); setChurchId(workspace) }}>
      <label htmlFor="conflict-church">Church workspace ID</label>
      <input id="conflict-church" required value={workspace} onChange={(event) => setWorkspace(event.target.value)} />
      <button>Open review queue</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading review queue…</p>}
    {teacherNotice && <div className="review-notice" role="status"><strong>Needs Owner Review</strong><p>An Owner must review the conflicting attendance. No other teacher or device details are shown.</p></div>}
    {!loading && churchId && !teacherNotice && conflicts.length === 0 && guests.length === 0 && <p>No attendance conflicts need review.</p>}
    <div className="conflict-list">{conflicts.map((conflict) => <article key={conflict.id} className="conflict-card">
      <h2>Attendance value conflict</h2>
      <p>Session {conflict.session_id} · Base version {conflict.base_version}</p>
      <div className="conflict-comparison">{evidence('Existing value', conflict.existing)}{evidence('Incoming value', conflict.incoming)}</div>
      <label htmlFor={`reason-${conflict.id}`}>Resolution reason</label>
      <textarea id={`reason-${conflict.id}`} maxLength={500} value={reasons[conflict.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [conflict.id]: event.target.value }))} />
      <div className="conflict-actions">
        <button className="secondary" onClick={() => void resolve(conflict, 'existing')}>Keep existing value</button>
        <button onClick={() => void resolve(conflict, 'incoming')}>Use incoming value</button>
      </div>
    </article>)}</div>
    {!teacherNotice && guests.length > 0 && <section className="guest-review" aria-labelledby="guest-review-heading">
      <h2 id="guest-review-heading">Temporary guests</h2>
      <p>Promote, link, or merge each pending guest. Original attendance actor and time stay attached.</p>
      <div className="guest-review-list">{guests.map((guest) => <article key={guest.id} className="conflict-card">
        <h3>{guest.display_name}</h3>
        <p>{guest.gender} · Actor {guest.actor_id} · Device {guest.device_id}</p>
        <p>Local {guest.local_time} · Server {guest.server_time}</p>
        <form aria-label={`Promote ${guest.display_name}`} onSubmit={(event) => void resolveGuest(event, guest, 'promote')}>
          <h4>Promote to a new student</h4>
          <label>First name<input name="first_name" required maxLength={120} /></label>
          <label>Last name<input name="last_name" required maxLength={120} /></label>
          <label>Gender<select name="gender" defaultValue={guest.gender}><option value="unspecified">Unspecified</option><option value="female">Female</option><option value="male">Male</option></select></label>
          <button>Promote guest</button>
        </form>
        {students.length > 0 && <form aria-label={`Link ${guest.display_name}`} onSubmit={(event) => void resolveGuest(event, guest, 'link')}>
          <h4>Link to an existing student</h4>
          <label>Student<select name="student_id" required>{students.map((student) => <option key={student.id} value={student.id}>{student.display_name}</option>)}</select></label>
          <button className="secondary">Link guest</button>
        </form>}
        {guests.some((candidate) => candidate.id !== guest.id) && <form aria-label={`Merge ${guest.display_name}`} onSubmit={(event) => void resolveGuest(event, guest, 'merge')}>
          <h4>Merge a duplicate</h4>
          <label>Canonical guest<select name="guest_id" required>{guests.filter((candidate) => candidate.id !== guest.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.display_name}</option>)}</select></label>
          <button className="secondary">Merge duplicate</button>
        </form>}
      </article>)}</div>
    </section>}
  </section>
}
