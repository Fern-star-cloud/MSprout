import { useEffect, useMemo, useRef, useState } from 'react'
import { avatarForGender } from '../students/avatar'
import { profileStore, type ProfileLockReason } from '../../offline/profile-store'
import { attendanceRepository, type AttendanceRepository } from './attendance-repository'
import type { AttendanceDraft, AttendanceState } from './domain'
import { Button, Dialog, ErrorSummary, StatusBadge } from '../../components/ui/Foundations'
import '../../styles/attendance-lifecycle.css'

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

function ConnectionState({ pending, needsPull }: { pending: number | null; needsPull: boolean }) {
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
      <span>{online ? 'Online' : 'Offline — saving on this device'}{pending === null ? ' · Upload count unavailable' : pending > 0 ? ` · ${pending} pending` : needsPull ? ' · No pending uploads' : ' · No pending changes'}{needsPull ? ' · Sync incomplete' : ''}</span>
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
  const [available, setAvailable] = useState<AttendanceDraft | null>(null)
  const [selection, setSelection] = useState<'checking' | 'ready' | 'unknown'>('checking')
  const [readRevision, setReadRevision] = useState(0)
  const [filter, setFilter] = useState<AttendanceState | 'all'>('all')
  const [guestOpen, setGuestOpen] = useState(false), [confirmOpen, setConfirmOpen] = useState(false)
  const guestTrigger = useRef<HTMLButtonElement>(null), finalizeTrigger = useRef<HTMLButtonElement>(null)
  const guestInput = useRef<HTMLInputElement>(null), rosterHeading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false), operating = useRef(false), opened = useRef(false), selectionGeneration = useRef(0)
  const deferredRefresh = useRef(false), refreshView = useRef<(() => void) | null>(null)
  const mutationGeneration = useRef(0), refreshing = useRef(0)
  const pointerFocus = useRef(false)
  const actionArea = useRef<HTMLDivElement>(null)
  const [compactActions, setCompactActions] = useState(false)
  const [search, setSearch] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestGender, setGuestGender] = useState<AttendanceDraft['entries'][number]['gender']>('unspecified')
  const [pending, setPending] = useState<number | null>(null)
  const [needsPull, setNeedsPull] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lockReason, setLockReason] = useState<ProfileLockReason | undefined>()
  const accessGeneration = useRef(0)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    const area = actionArea.current
    if (!area) return
    let active = true
    const navigation = document.querySelector('.phone-navigation')
    const measure = () => {
      if (!active) return
      const occupied = area.getBoundingClientRect().height + (navigation?.getBoundingClientRect().height ?? 0)
      setCompactActions(occupied > globalThis.innerHeight * .4)
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(area)
    if (navigation) observer?.observe(navigation)
    globalThis.addEventListener('resize', measure)
    queueMicrotask(measure)
    return () => { active = false; observer?.disconnect(); globalThis.removeEventListener('resize', measure) }
  }, [draft?.id])

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
    setAvailable(null); opened.current = false; selectionGeneration.current++; setSelection('unknown'); setGuestOpen(false); setConfirmOpen(false)
    setGuestName('')
    setGuestGender('unspecified')
    setSearch('')
    setPending(null)
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
    const generation = accessGeneration.current, selected = ++selectionGeneration.current
    const current = () => active && mounted.current && generation === accessGeneration.current && selected === selectionGeneration.current
    void Promise.allSettled([repository.findDraft(profile.id, ministryId, date), repository.countPending(profile.id)]).then(([found, count]) => {
      if (!current()) return
      setPending(count.status === 'fulfilled' ? count.value : null)
      if (found.status !== 'fulfilled') throw new Error('Saved attendance unavailable')
      const value = found.value
      if (value && (value.profileId !== profile.id || value.churchId !== profile.churchId || value.ministryId !== ministryId || value.attendanceDate !== date)) throw new Error('Session binding changed')
      setAvailable(value); setSelection('ready'); setError('')
      if (opened.current && value) setDraft(value)
    }).catch(() => { if (current()) { setSelection('unknown'); setError('Saved attendance could not be checked. Keep device storage and retry; do not start over uncertain work.') } })
    return () => { active = false }
  }, [date, ministryId, profile, repository, readRevision])

  useEffect(() => {
    if (!profile || !date) return
    let active = true
    const refreshAfterSync = () => {
      if (operating.current) { deferredRefresh.current = true; return }
      refreshing.current++
      const generation = accessGeneration.current, selected = selectionGeneration.current, mutation = mutationGeneration.current
      const currentView = () => active && mounted.current && generation === accessGeneration.current && selected === selectionGeneration.current && mutation === mutationGeneration.current
      void Promise.allSettled([
        store.activeProfile(),
        store.readEncryptedMinistries(profile.id),
        store.readEncryptedRoster(profile.id),
        repository.countPending(profile.id),
      ]).then(async ([currentResult, ministryResult, rosterResult, countResult]) => {
        if (!currentView()) return
        // A protected read can fail after uploads settle. Keep the independent queue
        // count accurate before clearing the unavailable roster.
        setPending(countResult.status === 'fulfilled' ? countResult.value : null)
        if (currentResult.status === 'rejected' || ministryResult.status === 'rejected'
          || rosterResult.status === 'rejected') throw new Error('Profile data unavailable')
        const current = currentResult.value
        if (!current || current.id !== profile.id || current.churchId !== profile.churchId) throw new Error('Active profile changed')
        const availableMinistries = ministryResult.value
        const availableRoster = rosterResult.value
        const pendingCount = countResult.status === 'fulfilled' ? countResult.value : null
        const nextMinistryId = availableMinistries.some(ministry => ministry.id === ministryId)
          ? ministryId
          : (availableMinistries[0]?.id ?? '')
        const currentDraft = nextMinistryId
          ? await repository.findDraft(profile.id, nextMinistryId, date)
          : null
        if (!currentView()) return
        if (currentDraft && (currentDraft.profileId !== profile.id || currentDraft.churchId !== profile.churchId || currentDraft.ministryId !== nextMinistryId || currentDraft.attendanceDate !== date)) throw new Error('Session binding changed')
        setMinistries(availableMinistries)
        setRoster(availableRoster)
        setMinistryId(nextMinistryId)
        setAvailable(currentDraft); setDraft(opened.current ? currentDraft : null); setConfirmOpen(false)
        setPending(pendingCount)
        setNeedsPull(Boolean(current?.id === profile.id && current.syncNeedsPull))
        setSaved(false)
        setError('')
      }).catch(() => {
        if (!currentView()) return
        setNeedsPull(true)
        setMinistries([])
        setRoster([])
        setMinistryId('')
        setDraft(null)
        setAvailable(null); opened.current = false; selectionGeneration.current++; setSelection('unknown'); setConfirmOpen(false); setGuestOpen(false); setGuestName(''); setGuestGender('unspecified'); setSearch('')
        setSaved(false)
        setError('Reconnect and authenticate this profile before reopening its assigned roster.')
      }).finally(() => { refreshing.current-- })
    }
    const invalidateAuthorization = () => {
      accessGeneration.current++; selectionGeneration.current++; opened.current = false
      setDraft(null); setAvailable(null); setMinistries([]); setRoster([]); setSelection('unknown')
      setGuestOpen(false); setConfirmOpen(false); setGuestName(''); setGuestGender('unspecified'); setSearch('')
      setSaved(false); setBusy(false); setNeedsPull(true)
      setError('Reconnect and authenticate this profile before reopening its assigned roster.')
      refreshAfterSync()
    }
    refreshView.current = refreshAfterSync
    globalThis.addEventListener('ministrysprout:sync-complete', refreshAfterSync)
    globalThis.addEventListener('ministrysprout:sync-authorization-invalid', invalidateAuthorization)
    return () => {
      active = false
      globalThis.removeEventListener('ministrysprout:sync-complete', refreshAfterSync)
      globalThis.removeEventListener('ministrysprout:sync-authorization-invalid', invalidateAuthorization)
      refreshView.current = null
    }
  }, [date, ministryId, profile, repository, store])

  const marked = draft?.entries.filter((entry) => entry.state !== 'unmarked').length ?? 0
  const unmarked = (draft?.entries.length ?? 0) - marked
  const visibleEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return draft?.entries.filter((entry) => (filter === 'all' || entry.state === filter) && entry.displayName.toLocaleLowerCase().includes(query)) ?? []
  }, [draft, search, filter])

  async function save(operation: () => Promise<AttendanceDraft>, opening = false) {
    if (!profile || operating.current || (!opening && draft?.status !== 'draft')) return false
    operating.current = true
    mutationGeneration.current++
    if (refreshing.current > 0) deferredRefresh.current = true
    const generation = accessGeneration.current, selected = selectionGeneration.current
    const current = () => mounted.current && generation === accessGeneration.current && selected === selectionGeneration.current
    setBusy(true)
    setSaved(false)
    setError('')
    try {
      const value = await operation()
      if (!current()) return false
      if (value.profileId !== profile.id || value.churchId !== profile.churchId || value.ministryId !== ministryId || value.attendanceDate !== date) throw new Error('Session binding changed')
      opened.current = true; setDraft(value); setAvailable(value); setSelection('ready')
      setSaved(!opening || available === null)
      setError('')
      // The domain transaction has committed. A status-read failure must not invite
      // a duplicate guest submission by falsely reporting that nothing was saved.
      try {
        const pendingCount = await repository.countPending(profile.id)
        if (current()) setPending(pendingCount)
      } catch {
        if (current()) { setPending(null); setError('Saved on this device, but the pending count could not be refreshed. Check Sync; do not repeat this saved change.') }
      }
      if (!current()) return false
      return true
    } catch {
      if (current()) setError('This change was not saved. Keep device storage, check authorization or reload saved attendance, and try again.')
      return false
    } finally {
      operating.current = false; if (mounted.current && generation === accessGeneration.current) setBusy(false)
      if (mounted.current && deferredRefresh.current) { deferredRefresh.current = false; refreshView.current?.() }
    }
  }

  async function addGuest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || operating.current) return
    const normalized = guestName.replace(/[\s\p{Z}]+/gu, ' ').trim()
    if (!normalized) {
      setError('Enter a guest display name.')
      return
    }
    if (await save(() => repository.addGuest(profile!.id, draft.id, normalized, guestGender))) {
      setGuestName('')
      setGuestGender('unspecified')
      setGuestOpen(false)
    }
  }

  function choose(nextMinistry: string, nextDate: string) {
    if (operating.current || guestOpen || confirmOpen) return
    selectionGeneration.current++; opened.current = false
    setDraft(null); setAvailable(null); setSelection('checking'); setSaved(false); setError(''); setSearch(''); setFilter('all'); setGuestName(''); setGuestGender('unspecified')
    setMinistryId(nextMinistry); setDate(nextDate)
  }
  async function begin() {
    if (!profile || selection !== 'ready' || operating.current) return
    const ministry = ministries.find(item => item.id === ministryId)
    if (!ministry) return
    const ok = await save(async () => {
      if (available) {
        const value = await repository.findDraft(profile.id, ministryId, date)
        if (!value) throw new Error('Saved session disappeared')
        return value
      }
      return repository.createDraft({ profileId: profile.id, churchId: profile.churchId, ministryId, ministryName: ministry.name, attendanceDate: date,
        students: roster.filter(student => student.ministry_ids.includes(ministryId)).map(student => ({ id: student.id, displayName: student.display_name, gender: student.gender })) })
    }, true)
    if (ok) rosterHeading.current?.focus()
  }
  const guests = draft?.guests.filter(guest => guest.status !== 'merged') ?? []
  const present = (draft?.entries.filter(entry => entry.state === 'present').length ?? 0) + guests.length
  const absent = draft?.entries.filter(entry => entry.state === 'absent').length ?? 0
  const editable = draft?.status === 'draft'
  const selectedState = ministryId && date ? selection : 'unknown'
  function reloadSaved() {
    setSelection('checking'); setAvailable(null); setDraft(null); setSaved(false); setConfirmOpen(false)
    setReadRevision(value => value + 1)
  }
  function keepFocusedControlVisible(event: React.FocusEvent<HTMLElement>) {
    const target = event.target, root = event.currentTarget
    // Never move a pointer target between press and release, which can cancel its click.
    if (pointerFocus.current || !target.closest('.attendance-layout')) return
    // Native focus scrolling does not account for the sticky actions or navigation.
    // Inspect after the browser's focus step; scrolling changes no attendance state.
    queueMicrotask(() => {
      if (!target.isConnected || document.activeElement !== target) return
      const rect = target.getBoundingClientRect()
      const overlays = [root.querySelector('.attendance-finalize-bar'), document.querySelector('.phone-navigation')]
      if (overlays.some(overlay => {
        if (!overlay) return false
        const cover = overlay.getBoundingClientRect()
        return cover.height > 0 && cover.left < rect.right && cover.right > rect.left && cover.top < rect.bottom && cover.bottom > rect.top
      })) target.scrollIntoView({ block: 'start', inline: 'nearest' })
    })
  }
  async function confirm() {
    if (!draft || !editable || draft.entries.some(entry => entry.state === 'unmarked') || operating.current) return
    if (await save(() => repository.finalizeDraft(profile!.id, draft.id))) setConfirmOpen(false)
  }

  if (loading && !profile) return <section className="attendance-empty"><h1>Take attendance</h1><p>Loading the protected roster…</p></section>
  if (!profile) return <section className="attendance-empty" data-profile-lock-reason={lockReason}><p className="eyebrow">Offline attendance</p><h1>Take attendance</h1><p>{error || 'Unlock a device profile to open its assigned roster.'}</p><a href="/profiles">Unlock an existing device profile</a></section>

  return <section className="attendance-screen" aria-labelledby="attendance-heading" onFocusCapture={keepFocusedControlVisible}
    onPointerDownCapture={() => { pointerFocus.current = true }} onPointerUpCapture={() => { pointerFocus.current = false }}
    onPointerCancelCapture={() => { pointerFocus.current = false }} onKeyDownCapture={() => { pointerFocus.current = false }}>
    <header className="attendance-heading"><div><p className="eyebrow">Offline-ready attendance</p><h1 id="attendance-heading">Take attendance</h1></div><ConnectionState pending={pending} needsPull={needsPull} /></header>
    {needsPull && <p role="status">Server updates have not finished downloading. Uploaded changes may already be accepted. Use Sync &amp; device to verify the same account and finish synchronization.</p>}
    <div className="attendance-layout">
      <aside className="attendance-session-panel" aria-label="Attendance session">
        <label htmlFor="attendance-ministry">Ministry</label><select id="attendance-ministry" value={ministryId} disabled={busy || guestOpen || confirmOpen} onChange={event => choose(event.target.value, date)}>{ministries.map(ministry => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select>
        <label htmlFor="attendance-date">Attendance date</label><input id="attendance-date" type="date" value={date} disabled={busy || guestOpen || confirmOpen} onChange={event => choose(ministryId, event.target.value)} aria-describedby="attendance-date-context" />
        <p id="attendance-date-context">Dates use this device’s local calendar and are saved as selected.</p>
        <p>Choose a ministry and date, then Start or Resume attendance.</p>
        {draft && <><p className="attendance-counts">{marked} marked · {unmarked} unmarked</p><p>{present} present · {absent} absent · {guests.length} temporary {guests.length === 1 ? 'guest' : 'guests'}</p><div className="attendance-bulk-actions"><Button variant="secondary" disabled={busy || !editable} onClick={() => void save(() => repository.bulkMark(profile.id, draft.id, 'present', 'unmarked'))}>Mark all unmarked present</Button><Button variant="secondary" disabled={busy || !editable} onClick={() => void save(() => repository.bulkMark(profile.id, draft.id, 'absent', 'unmarked'))}>Mark all unmarked absent</Button></div></>}
      </aside>
      <div className="attendance-roster-panel">
        {error && !guestOpen && !confirmOpen && <ErrorSummary message={error} />}
        {!draft ? <div className="attendance-lifecycle-choice">
          {busy && <p role="status">{available ? 'Opening saved attendance…' : 'Starting attendance on this device…'}</p>}
          {selectedState === 'checking' ? <p role="status">Checking saved attendance…</p> : selectedState === 'unknown' ? <><h2>Saved attendance status unknown</h2><Button variant="secondary" disabled={busy || !ministryId || !date} onClick={reloadSaved}>Check saved attendance</Button></> : <><h2>{available ? available.status === 'draft' ? 'Saved draft found' : 'Saved attendance found — read-only' : 'No draft for this date'}</h2><p>{available ? 'Open the existing saved session without creating another event.' : 'Start deliberately to mark students and add temporary guests.'}</p><Button busy={busy} onClick={() => void begin()}>{available ? 'Resume attendance' : 'Start attendance'}</Button></>}
        </div> : <>
          <h2 ref={rosterHeading} tabIndex={-1}>{draft.ministryName} · {draft.attendanceDate}</h2>
          {busy && <p role="status">Saving on this device…</p>}
          {saved && editable && <p className="attendance-save-state" role="status">✓ Saved on this device</p>}
          {draft.status === 'finalized_pending' ? <div role="status"><h3>Finalized on this device</h3><p>Saved on this device — Pending Sync</p><p>Waiting to synchronize. This session is read-only; local finalization is not server acceptance.</p><a href="/account/sync">Open Sync &amp; device</a></div> : !editable ? <p role="status">Saved {draft.status === 'needs_review' ? 'attendance needs review' : 'attendance is read-only'}. Transfer and unresolved review remain separate. <a href="/account/sync">Open Sync &amp; device</a></p> : <p>Local attendance is separate from server synchronization. <a href="/account/sync">Check Sync &amp; device</a></p>}
          <label htmlFor="attendance-search">Search roster</label><input id="attendance-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by display name" />
          <div className="attendance-filters" role="group" aria-label="Attendance status filters">{(['all', 'present', 'absent', 'unmarked'] as const).map(value => <Button key={value} variant="secondary" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</Button>)}</div>
          <ul className="attendance-roster" aria-label="Attendance entries">
            {visibleEntries.map(entry => <li key={entry.studentId}><img src={avatarForGender(entry.gender)} alt={`${entry.displayName} avatar`} /><div className="attendance-entry-name"><strong>{entry.displayName}</strong><StatusBadge tone={entry.state === 'unmarked' ? 'warning' : 'neutral'}>{entry.state[0].toUpperCase() + entry.state.slice(1)}</StatusBadge></div><div className="attendance-state-controls" role="group" aria-label={`Attendance for ${entry.displayName}`}>
              <button type="button" className={entry.state === 'present' ? 'is-selected' : 'secondary'} aria-pressed={entry.state === 'present'} aria-label={`Mark ${entry.displayName} present`} disabled={busy || !editable} onClick={() => void save(() => repository.markStudent(profile.id, draft.id, entry.studentId, 'present'))}>{entry.state === 'present' && <span aria-hidden="true">✓ </span>}Present</button>
              <button type="button" className={entry.state === 'absent' ? 'is-selected is-absent' : 'secondary'} aria-pressed={entry.state === 'absent'} aria-label={`Mark ${entry.displayName} absent`} disabled={busy || !editable} onClick={() => void save(() => repository.markStudent(profile.id, draft.id, entry.studentId, 'absent'))}>{entry.state === 'absent' && <span aria-hidden="true">✓ </span>}Absent</button>
            </div></li>)}
            {(filter === 'all' || filter === 'present') && guests.filter(guest => guest.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(guest => <li key={guest.id}><img src={avatarForGender(guest.gender)} alt={`${guest.displayName} avatar`} /><strong>{guest.displayName}</strong><span className="guest-badge">Temporary guest · Present</span></li>)}
          </ul>{visibleEntries.length === 0 && ((filter !== 'all' && filter !== 'present') || !guests.some(guest => guest.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))) && <p>No entries match this filter.</p>}
          {error && <Button variant="secondary" disabled={busy} onClick={() => { opened.current = true; reloadSaved() }}>Reload saved attendance</Button>}
        </>}
      </div>
    </div>
    {draft && <div ref={actionArea} className={`attendance-finalize-bar${compactActions ? ' is-compact' : ''}`}><Button ref={guestTrigger} variant="secondary" disabled={busy || !editable} onClick={() => setGuestOpen(true)}>Add temporary guest</Button><span>{unmarked ? `Mark ${unmarked} remaining student${unmarked === 1 ? '' : 's'} first` : 'Every regular roster entry is marked'}</span><Button ref={finalizeTrigger} disabled={busy || !editable || unmarked > 0} onClick={() => setConfirmOpen(true)}>Finalize attendance</Button></div>}
    {guestOpen && <Dialog open title="Add temporary guest" description="This attendance session only. Display name and optional gender; no guardian or contact details." onClose={() => { if (!operating.current) setGuestOpen(false) }} initialFocus={guestInput} returnFocus={guestTrigger}>
      <form className="attendance-guest-form" onSubmit={event => void addGuest(event)}>
        <label htmlFor="attendance-guest-name">Display name</label><input ref={guestInput} id="attendance-guest-name" maxLength={120} value={guestName} onChange={event => setGuestName(event.target.value)} disabled={busy} required />
        <label htmlFor="attendance-guest-gender">Gender (optional)</label><select id="attendance-guest-gender" value={guestGender} onChange={event => setGuestGender(event.target.value as typeof guestGender)} disabled={busy}><option value="unspecified">Not specified</option><option value="female">Female</option><option value="male">Male</option></select>
        {error && <ErrorSummary message={error} />}<div className="attendance-dialog-actions"><Button variant="secondary" disabled={busy} onClick={() => setGuestOpen(false)}>Cancel</Button><Button type="submit" busy={busy} disabled={!guestName.trim()}>Add guest as present</Button></div>
      </form>
    </Dialog>}
    {confirmOpen && draft && <Dialog open title="Finalize this session?" description="Finalizing locks this session on this device. It still needs synchronization." onClose={() => { if (!operating.current) setConfirmOpen(false) }} returnFocus={finalizeTrigger}>
      <p>{draft.ministryName} · {draft.attendanceDate}</p><p>{draft.entries.length} regular students + {guests.length} {guests.length === 1 ? 'guest' : 'guests'}</p><p>{present} present · {absent} absent · {unmarked} unmarked</p>{error && <ErrorSummary message={error} />}<div className="attendance-dialog-actions"><Button variant="secondary" disabled={busy} onClick={() => setConfirmOpen(false)}>Keep editing</Button><Button busy={busy} disabled={!editable || unmarked > 0} onClick={() => void confirm()}>Finalize on this device</Button></div>
    </Dialog>}
  </section>
}
