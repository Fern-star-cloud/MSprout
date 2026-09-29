import { useEffect, useMemo, useState } from 'react'
import { avatarForGender } from '../students/avatar'
import { profileStore } from '../../offline/profile-store'
import { attendanceRepository, type AttendanceRepository } from './attendance-repository'
import type { AttendanceDraft, AttendanceState } from './domain'

interface OfflineMinistry {
  id: string
  name: string
  version: number
}

interface OfflineRosterStudent {
  id: string
  display_name: string
  gender: 'male' | 'female' | 'unspecified'
  ministry_ids: string[]
}

interface AttendanceStore {
  activeProfile(): Promise<{ id: string; churchId: string | null } | null>
  readEncryptedMinistries(profileId: string): Promise<OfflineMinistry[]>
  readEncryptedRoster(profileId: string): Promise<OfflineRosterStudent[]>
}

interface AttendanceDataRepository {
  findDraft(profileId: string, ministryId: string, attendanceDate: string): Promise<AttendanceDraft | null>
  createDraft(input: Parameters<AttendanceRepository['createDraft']>[0]): Promise<AttendanceDraft>
  markStudent(profileId: string, draftId: string, studentId: string, state: AttendanceState): Promise<AttendanceDraft>
  bulkMark(profileId: string, draftId: string, state: AttendanceState, only?: AttendanceState): Promise<AttendanceDraft>
  finalizeDraft(profileId: string, draftId: string): Promise<AttendanceDraft>
  countPending(profileId: string): Promise<number>
}

function today(): string {
  const value = new Date()
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function ConnectionState({ pending }: { pending: number }) {
  const [online, setOnline] = useState(globalThis.navigator?.onLine !== false)

  useEffect(() => {
    const update = () => setOnline(globalThis.navigator?.onLine !== false)
    globalThis.addEventListener('online', update)
    globalThis.addEventListener('offline', update)
    return () => {
      globalThis.removeEventListener('online', update)
      globalThis.removeEventListener('offline', update)
    }
  }, [])

  return (
    <div className="attendance-connection" role="status" aria-live="polite">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d={online ? 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01' : 'm4 4 16 16M5 12.5a10 10 0 0 1 5-2.6M14 9.8a10 10 0 0 1 5 2.7'} /></svg>
      <span>{online ? 'Online' : 'Offline — saving on this device'}{pending > 0 ? ` · ${pending} pending` : ' · No pending changes'}</span>
    </div>
  )
}

export function AttendanceScreen({
  repository = attendanceRepository,
  store = profileStore,
  initialDate = today(),
}: {
  repository?: AttendanceDataRepository
  store?: AttendanceStore
  initialDate?: string
}) {
  const [profile, setProfile] = useState<{ id: string; churchId: string } | null>(null)
  const [ministries, setMinistries] = useState<OfflineMinistry[]>([])
  const [roster, setRoster] = useState<OfflineRosterStudent[]>([])
  const [ministryId, setMinistryId] = useState('')
  const [date, setDate] = useState(initialDate)
  const [draft, setDraft] = useState<AttendanceDraft | null>(null)
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState(0)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void store.activeProfile().then(async (current) => {
      if (!current?.churchId) return null
      const [availableMinistries, availableRoster] = await Promise.all([
        store.readEncryptedMinistries(current.id),
        store.readEncryptedRoster(current.id),
      ])
      if (!active) return null
      setProfile({ id: current.id, churchId: current.churchId })
      setMinistries(availableMinistries)
      setRoster(availableRoster)
      setMinistryId(availableMinistries[0]?.id ?? '')
      return null
    }).catch(() => { if (active) setError('Unlock a current device profile with a valid offline authorization before taking attendance.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [store])

  useEffect(() => {
    if (!profile || !ministryId || !date) return
    let active = true
    const ministry = ministries.find((candidate) => candidate.id === ministryId)
    const students = roster.filter((student) => student.ministry_ids.includes(ministryId))
    void repository.findDraft(profile.id, ministryId, date).then((existing) => existing ?? repository.createDraft({
      profileId: profile.id,
      churchId: profile.churchId,
      ministryId,
      ministryName: ministry?.name ?? 'Assigned ministry',
      attendanceDate: date,
      students: students.map((student) => ({ id: student.id, displayName: student.display_name, gender: student.gender })),
    })).then(async (value) => {
      if (!active) return
      setDraft(value)
      setPending(await repository.countPending(profile.id))
      setError('')
    }).catch(() => { if (active) setError('Attendance could not be saved on this device. Free storage or unlock the profile before continuing.') })
    return () => { active = false }
  }, [date, ministries, ministryId, profile, repository, roster])

  useEffect(() => {
    if (!profile || !date) return
    let active = true
    const refreshAfterSync = () => {
      void Promise.all([
        store.readEncryptedMinistries(profile.id),
        store.readEncryptedRoster(profile.id),
        repository.countPending(profile.id),
      ]).then(async ([availableMinistries, availableRoster, pendingCount]) => {
        const nextMinistryId = availableMinistries.some(ministry => ministry.id === ministryId)
          ? ministryId
          : (availableMinistries[0]?.id ?? '')
        const currentDraft = nextMinistryId
          ? await repository.findDraft(profile.id, nextMinistryId, date)
          : null
        if (!active) return
        setMinistries(availableMinistries)
        setRoster(availableRoster)
        setMinistryId(nextMinistryId)
        setDraft(currentDraft)
        setPending(pendingCount)
        setSaved(false)
        setError('')
      }).catch(() => {
        if (!active) return
        setMinistries([])
        setRoster([])
        setMinistryId('')
        setDraft(null)
        setPending(0)
        setSaved(false)
        setError('Reconnect and authenticate this profile before reopening its assigned roster.')
      })
    }
    globalThis.addEventListener('ministrysprout:sync-complete', refreshAfterSync)
    globalThis.addEventListener('ministrysprout:sync-authorization-invalid', refreshAfterSync)
    return () => {
      active = false
      globalThis.removeEventListener('ministrysprout:sync-complete', refreshAfterSync)
      globalThis.removeEventListener('ministrysprout:sync-authorization-invalid', refreshAfterSync)
    }
  }, [date, ministryId, profile, repository, store])

  const marked = draft?.entries.filter((entry) => entry.state !== 'unmarked').length ?? 0
  const unmarked = (draft?.entries.length ?? 0) - marked
  const visibleEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return draft?.entries.filter((entry) => entry.displayName.toLocaleLowerCase().includes(query)) ?? []
  }, [draft, search])

  async function save(operation: () => Promise<AttendanceDraft>) {
    if (!profile) return
    setBusy(true)
    try {
      setDraft(await operation())
      setPending(await repository.countPending(profile.id))
      setSaved(true)
      setError('')
    } catch {
      setError('This change was not saved. Free device storage, unlock the profile, and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !profile) return <section className="attendance-empty"><h1>Take attendance</h1><p>Loading the protected roster…</p></section>
  if (!profile) return <section className="attendance-empty"><p className="eyebrow">Offline attendance</p><h1>Take attendance</h1><p>{error || 'Unlock a device profile to open its assigned roster.'}</p><a href="/profiles">Choose a device profile</a></section>

  return (
    <section className="attendance-screen" aria-labelledby="attendance-heading">
      <header className="attendance-heading">
        <div><p className="eyebrow">Offline-ready attendance</p><h1 id="attendance-heading">Take attendance</h1></div>
        <ConnectionState pending={pending} />
      </header>
      <div className="attendance-layout">
        <aside className="attendance-session-panel" aria-label="Attendance session">
          <label htmlFor="attendance-ministry">Ministry</label>
          <select id="attendance-ministry" value={ministryId} onChange={(event) => { setSaved(false); setDraft(null); setMinistryId(event.target.value) }}>
            {ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
          </select>
          <label htmlFor="attendance-date">Attendance date</label>
          <input id="attendance-date" type="date" value={date} onChange={(event) => { setSaved(false); setDraft(null); setDate(event.target.value) }} />
          <p className="attendance-counts">{marked} marked · {unmarked} unmarked</p>
          <div className="attendance-bulk-actions">
            <button type="button" className="secondary" disabled={!draft || busy || draft.status !== 'draft'} onClick={() => void save(() => repository.bulkMark(profile.id, draft!.id, 'present', 'unmarked'))}>Mark all unmarked present</button>
            <button type="button" className="secondary" disabled={!draft || busy || draft.status !== 'draft'} onClick={() => void save(() => repository.bulkMark(profile.id, draft!.id, 'absent', 'unmarked'))}>Mark all unmarked absent</button>
          </div>
        </aside>
        <div className="attendance-roster-panel">
          <label htmlFor="attendance-search">Search roster</label>
          <input id="attendance-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by display name" />
          {error && <p role="alert">{error}</p>}
          {saved && draft?.status === 'draft' && <p className="attendance-save-state" role="status">✓ Saved on this device</p>}
          {draft?.status === 'finalized_pending' && <p className="attendance-save-state" role="status">✓ Saved on this device — Pending Sync</p>}
          <ul className="attendance-roster">
            {visibleEntries.map((entry) => <li key={entry.studentId}>
              <img src={avatarForGender(entry.gender)} alt={`${entry.displayName} avatar`} />
              <strong>{entry.displayName}</strong>
              <div className="attendance-state-controls" aria-label={`Attendance for ${entry.displayName}`}>
                <button type="button" className={entry.state === 'present' ? 'is-selected' : 'secondary'} aria-pressed={entry.state === 'present'} aria-label={`Mark ${entry.displayName} present`} disabled={busy || draft?.status !== 'draft'} onClick={() => void save(() => repository.markStudent(profile.id, draft!.id, entry.studentId, 'present'))}>✓ Present</button>
                <button type="button" className={entry.state === 'absent' ? 'is-selected is-absent' : 'secondary'} aria-pressed={entry.state === 'absent'} aria-label={`Mark ${entry.displayName} absent`} disabled={busy || draft?.status !== 'draft'} onClick={() => void save(() => repository.markStudent(profile.id, draft!.id, entry.studentId, 'absent'))}>× Absent</button>
              </div>
            </li>)}
          </ul>
        </div>
      </div>
      <div className="attendance-finalize-bar">
        <span>{unmarked > 0 ? `${unmarked} student${unmarked === 1 ? '' : 's'} still unmarked` : 'Every regular roster entry is marked'}</span>
        <button type="button" disabled={!draft || busy || unmarked > 0 || draft.status !== 'draft'} onClick={() => void save(() => repository.finalizeDraft(profile.id, draft!.id))}>Finalize attendance</button>
      </div>
    </section>
  )
}
