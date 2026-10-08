import { useEffect, useMemo, useRef, useState } from 'react'
import { avatarForGender } from '../students/avatar'
import { profileStore, type ProfileLockReason } from '../../offline/profile-store'
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
  onLock(listener: (profileId: string, reason: ProfileLockReason) => void): () => void
  activeProfile(): Promise<{ id: string; churchId: string | null; syncNeedsPull?: boolean } | null>
  readEncryptedMinistries(profileId: string): Promise<OfflineMinistry[]>
  readEncryptedRoster(profileId: string): Promise<OfflineRosterStudent[]>
}

interface AttendanceDataRepository {
  findDraft(profileId: string, ministryId: string, attendanceDate: string): Promise<AttendanceDraft | null>
  createDraft(input: Parameters<AttendanceRepository['createDraft']>[0]): Promise<AttendanceDraft>
  markStudent(profileId: string, draftId: string, studentId: string, state: AttendanceState): Promise<AttendanceDraft>
  bulkMark(profileId: string, draftId: string, state: AttendanceState, only?: AttendanceState): Promise<AttendanceDraft>
  finalizeDraft(profileId: string, draftId: string): Promise<AttendanceDraft>
  addGuest(profileId: string, draftId: string, displayName: string, gender: AttendanceDraft['entries'][number]['gender']): Promise<AttendanceDraft>
  countPending(profileId: string): Promise<number>
}

function today(): string {
  const value = new Date()
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function ConnectionState({ pending, needsPull }: { pending: number; needsPull: boolean }) {
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
      <span>{online ? 'Online' : 'Offline — saving on this device'}{pending > 0 ? ` · ${pending} pending` : needsPull ? ' · No pending uploads' : ' · No pending changes'}{needsPull ? ' · Sync incomplete' : ''}</span>
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
  const [guestName, setGuestName] = useState('')
  const [guestGender, setGuestGender] = useState<AttendanceDraft['entries'][number]['gender']>('unspecified')
  const [pending, setPending] = useState(0)
  const [needsPull, setNeedsPull] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lockReason, setLockReason] = useState<ProfileLockReason | undefined>()
  const accessGeneration = useRef(0)

  useEffect(() => store.onLock((_profileId, reason) => {
    // Locking removes the in-memory key. Discard the corresponding plaintext view too,
    // and prevent an earlier asynchronous load/save from putting it back.
    accessGeneration.current += 1
    setLockReason(reason)
    setProfile(null)
    setMinistries([])
    setRoster([])
    setMinistryId('')
    setDraft(null)
    setGuestName('')
    setGuestGender('unspecified')
    setSearch('')
    setPending(0)
    setNeedsPull(false)
    setSaved(false)
    setBusy(false)
    setLoading(false)
    setError('This device profile is locked. Unlock the existing profile to continue. If its authorization has expired, reconnect and refresh authorization after sign-in.')
  }), [store])

  useEffect(() => {
    let active = true
    const generation = accessGeneration.current
    void store.activeProfile().then(async (current) => {
      if (!current?.churchId) return null
      if (active && generation === accessGeneration.current) setNeedsPull(Boolean(current.syncNeedsPull))
      const [availableMinistries, availableRoster] = await Promise.all([
        store.readEncryptedMinistries(current.id),
        store.readEncryptedRoster(current.id),
      ])
      if (!active || generation !== accessGeneration.current) return null
      setProfile({ id: current.id, churchId: current.churchId })
      setMinistries(availableMinistries)
      setRoster(availableRoster)
      setMinistryId(availableMinistries[0]?.id ?? '')
      return null
    }).catch(() => { if (active && generation === accessGeneration.current) setError('Unlock a current device profile with a valid offline authorization before taking attendance.') })
      .finally(() => { if (active && generation === accessGeneration.current) setLoading(false) })
    return () => { active = false }
  }, [store])

  useEffect(() => {
    if (!profile || !ministryId || !date) return
    let active = true
    const generation = accessGeneration.current
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
      const pendingCount = await repository.countPending(profile.id)
      if (!active || generation !== accessGeneration.current) return
      setDraft(value)
      setPending(pendingCount)
      setError('')
    }).catch(() => { if (active && generation === accessGeneration.current) setError('Attendance could not be saved on this device. Free storage or unlock the profile before continuing.') })
    return () => { active = false }
  }, [date, ministries, ministryId, profile, repository, roster])

  useEffect(() => {
    if (!profile || !date) return
    let active = true
    const refreshAfterSync = () => {
      const generation = accessGeneration.current
      void Promise.allSettled([
        store.activeProfile(),
        store.readEncryptedMinistries(profile.id),
        store.readEncryptedRoster(profile.id),
        repository.countPending(profile.id),
      ]).then(async ([currentResult, ministryResult, rosterResult, countResult]) => {
        if (!active || generation !== accessGeneration.current) return
        // A protected read can fail after uploads settle. Keep the independent queue
        // count accurate before clearing the unavailable roster.
        if (countResult.status === 'fulfilled') setPending(countResult.value)
        if (currentResult.status === 'rejected' || ministryResult.status === 'rejected'
          || rosterResult.status === 'rejected' || countResult.status === 'rejected') throw new Error('Profile data unavailable')
        const current = currentResult.value
        const availableMinistries = ministryResult.value
        const availableRoster = rosterResult.value
        const pendingCount = countResult.value
        const nextMinistryId = availableMinistries.some(ministry => ministry.id === ministryId)
          ? ministryId
          : (availableMinistries[0]?.id ?? '')
        const currentDraft = nextMinistryId
          ? await repository.findDraft(profile.id, nextMinistryId, date)
          : null
        if (!active || generation !== accessGeneration.current) return
        setMinistries(availableMinistries)
        setRoster(availableRoster)
        setMinistryId(nextMinistryId)
        setDraft(currentDraft)
        setPending(pendingCount)
        setNeedsPull(Boolean(current?.id === profile.id && current.syncNeedsPull))
        setSaved(false)
        setError('')
      }).catch(() => {
        if (!active || generation !== accessGeneration.current) return
        setNeedsPull(true)
        setMinistries([])
        setRoster([])
        setMinistryId('')
        setDraft(null)
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
    if (!profile) return false
    const generation = accessGeneration.current
    setBusy(true)
    setSaved(false)
    try {
      const value = await operation()
      if (generation !== accessGeneration.current) return false
      setDraft(value)
      setSaved(true)
      setError('')
      // The domain transaction has committed. A status-read failure must not invite
      // a duplicate guest submission by falsely reporting that nothing was saved.
      try {
        const pendingCount = await repository.countPending(profile.id)
        if (generation === accessGeneration.current) setPending(pendingCount)
      } catch {
        if (generation === accessGeneration.current) setError('Saved on this device, but the pending count could not be refreshed. Reopen attendance to refresh it.')
      }
      if (generation !== accessGeneration.current) return false
      return true
    } catch {
      if (generation === accessGeneration.current) setError('This change was not saved. Free device storage, unlock the profile, and try again.')
      return false
    } finally {
      if (generation === accessGeneration.current) setBusy(false)
    }
  }

  async function addGuest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    const normalized = guestName.replace(/[\s\p{Z}]+/gu, ' ').trim()
    if (!normalized) {
      setError('Enter a guest display name.')
      return
    }
    if (await save(() => repository.addGuest(profile!.id, draft.id, normalized, guestGender))) {
      setGuestName('')
      setGuestGender('unspecified')
    }
  }

  if (loading && !profile) return <section className="attendance-empty"><h1>Take attendance</h1><p>Loading the protected roster…</p></section>
  if (!profile) return <section className="attendance-empty" data-profile-lock-reason={lockReason}><p className="eyebrow">Offline attendance</p><h1>Take attendance</h1><p>{error || 'Unlock a device profile to open its assigned roster.'}</p><a href="/profiles">Choose a device profile</a></section>

  return (
    <section className="attendance-screen" aria-labelledby="attendance-heading">
      <header className="attendance-heading">
        <div><p className="eyebrow">Offline-ready attendance</p><h1 id="attendance-heading">Take attendance</h1></div>
        <ConnectionState pending={pending} needsPull={needsPull} />
      </header>
      {needsPull && <p role="status">Server updates have not finished downloading. Uploaded changes may already be accepted. Sign in as this teacher and refresh authorization to finish synchronization.</p>}
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
          <form className="attendance-guest-form" aria-label="Add temporary guest" onSubmit={(event) => void addGuest(event)}>
            <h2>Add guest</h2>
            <label htmlFor="attendance-guest-name">Display name</label>
            <input id="attendance-guest-name" maxLength={120} value={guestName} onChange={(event) => setGuestName(event.target.value)} disabled={!draft || busy || draft.status !== 'draft'} />
            <label htmlFor="attendance-guest-gender">Gender (optional)</label>
            <select id="attendance-guest-gender" value={guestGender} onChange={(event) => setGuestGender(event.target.value as typeof guestGender)} disabled={!draft || busy || draft.status !== 'draft'}>
              <option value="unspecified">Unspecified</option><option value="female">Female</option><option value="male">Male</option>
            </select>
            <button type="submit" className="secondary" disabled={!draft || busy || draft.status !== 'draft' || !guestName.trim()}>Add guest as present</button>
            <p>Only a display name and optional gender are saved. Guardian and contact details are not accepted in this offline guest flow.</p>
          </form>
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
            {(draft?.guests ?? []).filter((guest) => guest.status !== 'merged' && guest.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map((guest) => <li key={guest.id}>
              <img src={avatarForGender(guest.gender)} alt={`${guest.displayName} avatar`} />
              <strong>{guest.displayName}</strong>
              <span className="guest-badge">Temporary guest · Present</span>
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
