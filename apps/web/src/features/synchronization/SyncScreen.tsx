import { useCallback, useEffect, useRef, useState } from 'react'
import { liveQuery } from 'dexie'
import { Button, ErrorSummary, Field, StatusBanner } from '../../components/ui/Foundations'
import { HomeIcon } from '../../components/ui/HomeIcon'
import { ProfilePinError, profileStore, type LocalProfileStore } from '../../offline/profile-store'
import { offlineDatabase } from '../../offline/db'
import type { ProfileRecord } from '../../offline/schema'
import type { SyncSummary } from '../../sync/sync-client'
import { accountEntry } from '../auth/account-session'
import { authRequest } from '../auth/transport'
import { readPreparationAccess } from '../device-profiles/preparation-access'
import { syncRecovery } from './sync-recovery'
import { readSyncStatus, syncHeadline, unknownSyncStatus, type SyncStatus } from './sync-status'
import '../../styles/synchronization.css'

type SyncStore = Pick<LocalProfileStore, 'listProfiles' | 'isUnlocked' | 'unlockProfile' | 'lockProfile' | 'onLock'>
interface Recovery { continue(profile: ProfileRecord, verify: () => Promise<void>, check: () => void): Promise<SyncSummary> }
type Subscription = (profileId: string, next: (value: SyncStatus) => void) => () => void
const subscribeStatus: Subscription = (id, next) => {
  let active = true, generation = 0
  // Track Dexie reads before lease-bound WebCrypto leaves its live-query zone.
  // Every input of the projection is observed, including updated encrypted drafts.
  const subscription = liveQuery(() => Promise.all([
    offlineDatabase.profiles.get(id), offlineDatabase.serverCursors.get(id),
    offlineDatabase.outboxEvents.where('profileId').equals(id).toArray(),
    offlineDatabase.conflicts.where('profileId').equals(id).toArray(),
    offlineDatabase.attendanceDrafts.where('profileId').equals(id).toArray(),
  ])).subscribe({ next: () => {
    const run = ++generation
    void readSyncStatus(id).then(value => { if (active && run === generation) next(value) })
      .catch(() => { if (active && run === generation) next(unknownSyncStatus) })
  }, error: () => { generation++; if (active) next(unknownSyncStatus) } })
  return () => { active = false; generation++; subscription.unsubscribe() }
}
type SessionState = 'checking' | 'verified' | 'unavailable' | 'offline'

export function SyncScreen({ store = profileStore, recovery = syncRecovery, statusReader = readSyncStatus, subscribe = subscribeStatus }: {
  store?: SyncStore; recovery?: Recovery; statusReader?: typeof readSyncStatus; subscribe?: Subscription
}) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]), [selected, setSelected] = useState('')
  const [loaded, setLoaded] = useState(false), [online, setOnline] = useState(navigator.onLine)
  const [session, setSession] = useState<SessionState>(navigator.onLine ? 'checking' : 'offline')
  const [status, setStatus] = useState<SyncStatus>(unknownSyncStatus)
  const [serverReview, setServerReview] = useState<boolean | null>(null)
  const [pin, setPin] = useState(''), [pinError, setPinError] = useState(''), [error, setError] = useState('')
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const [action, setAction] = useState<'verify' | 'unlock' | 'sync' | 'status' | null>(null)
  const [interrupted, setInterrupted] = useState(false)
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [retryUntil, setRetryUntil] = useState(0), [clock, setClock] = useState(Date.now)
  const [revision, setRevision] = useState(0)
  const mounted = useRef(false), epoch = useRef(0), operating = useRef(false), unlocking = useRef(false)
  const connectionState = useRef(navigator.onLine)
  const continueButton = useRef<HTMLButtonElement>(null), focusAfterUnlock = useRef(false)
  const target = useRef<ProfileRecord | undefined>(undefined)
  const profile = profiles.find(item => item.id === selected)
  useEffect(() => { target.current = profile }, [profile])
  const unlocked = !!profile && store.isUnlocked(profile.id)
  const remaining = Math.max(0, Math.ceil((Math.max(retryUntil, Date.parse(profile?.retryAfter ?? '') || 0) - clock) / 1000))

  const verifyAccount = useCallback(async (item: ProfileRecord) => {
    if (!item.churchId) throw new Error('Profile preparation is incomplete')
    const access = await readPreparationAccess(item.churchId)
    if (!('actorId' in access) || access.actorId !== item.actorId || access.workspace.church_id !== item.churchId) throw new Error('Account binding changed')
    return access
  }, [])
  const review = useCallback(async (item: ProfileRecord, current: () => boolean) => {
    try {
      const result = await authRequest<{ data?: unknown[]; needs_owner_review?: boolean }>('/api/sync-conflicts', 'GET', undefined, item.churchId!)
      const value = typeof result.needs_owner_review === 'boolean' ? result.needs_owner_review
        : Array.isArray(result.data) ? result.data.length > 0 : null
      if (current()) setServerReview(value)
    } catch { if (current()) setServerReview(null) }
  }, [])

  useEffect(() => {
    mounted.current = true
    let active = true
    void store.listProfiles().then(values => {
      if (!active) return
      setProfiles(values); setSelected(values.find(item => store.isUnlocked(item.id))?.id ?? values[0]?.id ?? ''); setLoaded(true)
    }).catch(() => { if (active) { setLoaded(true); setError('Device profiles could not be read. Keep browser storage and try reloading.') } })
    const cancel = () => { epoch.current++ }
    return () => { active = false; mounted.current = false; cancel() }
  }, [store])

  useEffect(() => {
    const clear = () => { epoch.current++; setPin(''); setStatus(unknownSyncStatus); setSummary(null); setServerReview(null); setRevision(value => value + 1) }
    const unsubscribe = store.onLock((id, reason) => {
      // Direct unlock itself closes the old key. Other lock reasons always cancel.
      if (unlocking.current && reason === 'profile_switch') return
      if (id === target.current?.id) { clear(); setMessage('Profile locked. Encrypted work is retained. Unlock the existing profile to continue.') }
    })
    const connection = () => {
      if (connectionState.current === navigator.onLine) return
      connectionState.current = navigator.onLine
      setOnline(navigator.onLine); clear(); setSession(navigator.onLine ? 'checking' : 'offline')
    }
    const invalid = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: number; churchId?: string }>).detail
      if (detail?.status === 403 && detail.churchId && detail.churchId !== target.current?.churchId) return
      clear(); setSession('unavailable'); setMessage('Account access changed. Verify the same church account before continuing.')
      if (operating.current && target.current) store.lockProfile(target.current.id)
    }
    const visibility = () => { if (document.visibilityState === 'hidden') { clear(); if (target.current) store.lockProfile(target.current.id) } }
    window.addEventListener('online', connection); window.addEventListener('offline', connection)
    window.addEventListener('church-workspace-invalidated', invalid)
    document.addEventListener('visibilitychange', visibility)
    return () => { unsubscribe(); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); window.removeEventListener('church-workspace-invalidated', invalid); document.removeEventListener('visibilitychange', visibility) }
  }, [store])

  useEffect(() => {
    if (!profile || !online) return
    let active = true
    const run = epoch.current
    const current = () => active && mounted.current && run === epoch.current
    void verifyAccount(profile).then(() => {
      if (!current()) return
      setSession('verified'); if (store.isUnlocked(profile.id)) void review(profile, current)
    }).catch(() => { if (current()) { setSession('unavailable'); setError('Account access could not be verified. Check the same church account, email, current-session MFA and membership in Account, then verify again.') } })
    return () => { active = false }
  }, [profile, online, review, verifyAccount, store])

  useEffect(() => {
    if (!selected || !unlocked || (session !== 'verified' && session !== 'offline')) return
    let active = true
    const run = epoch.current
    const next = (value: SyncStatus) => { if (active && run === epoch.current && store.isUnlocked(selected)) setStatus(value) }
    void statusReader(selected).then(next).catch(() => next(unknownSyncStatus))
    const unsubscribe = subscribe(selected, next)
    return () => { active = false; unsubscribe() }
  }, [selected, unlocked, session, statusReader, subscribe, store, revision])
  useEffect(() => {
    if (!remaining) return
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [remaining])
  useEffect(() => {
    const update = async (failed: boolean) => {
      const item = target.current, run = epoch.current
      if (!item || !store.isUnlocked(item.id)) return
      const current = () => mounted.current && run === epoch.current && store.isUnlocked(item.id)
      const values = await store.listProfiles().catch(() => [])
      if (!current()) return
      if (failed && values.find(value => value.id === item.id)?.requiresReauthentication) {
        setSession('unavailable'); setStatus(unknownSyncStatus); setServerReview(null)
      } else {
        const value = await statusReader(item.id).catch(() => unknownSyncStatus)
        if (!current()) return
        setStatus(value)
        if (!failed && value.downloads === 'complete') setInterrupted(false)
        if (session === 'verified') await review(item, current)
      }
      if (current() && failed) { setInterrupted(true); setSummary(null); setMessage('Synchronization interrupted. Verify account access and retry with this profile; uploads may already be accepted and downloads may be incomplete.') }
    }
    const complete = () => { void update(false) }, invalid = () => { void update(true) }
    window.addEventListener('ministrysprout:sync-complete', complete); window.addEventListener('ministrysprout:sync-authorization-invalid', invalid)
    return () => { window.removeEventListener('ministrysprout:sync-complete', complete); window.removeEventListener('ministrysprout:sync-authorization-invalid', invalid) }
  }, [store, statusReader, review, session])
  useEffect(() => {
    if (!busy && unlocked && focusAfterUnlock.current) { focusAfterUnlock.current = false; continueButton.current?.focus() }
  }, [busy, unlocked])

  async function act(action: 'verify' | 'unlock' | 'sync') {
    if (!profile || !navigator.onLine || remaining || operating.current) return
    if (action === 'unlock' && !/^\d{6,12}$/.test(pin)) { setPinError('Enter the existing 6–12 digit PIN. Leading zeros are kept.'); return }
    operating.current = true; setBusy(true); setAction(action); setError(''); setPinError(''); setSummary(null); setMessage('Verifying the same church account…')
    const run = epoch.current, item = profile
    const current = () => mounted.current && run === epoch.current && target.current?.id === item.id && navigator.onLine && document.visibilityState !== 'hidden'
    const check = () => { if (!current()) throw new Error('Recovery interrupted') }
    try {
      const access = await verifyAccount(item); check(); setSession('verified')
      if (action === 'unlock') {
        unlocking.current = true
        try { await store.unlockProfile(item.id, pin) } finally { unlocking.current = false }
        check(); setPin(''); setRevision(value => value + 1); focusAfterUnlock.current = true
        setMessage('Existing profile unlocked. Continue synchronization when ready; no attendance was created.')
      } else if (action === 'sync') {
        if (!store.isUnlocked(item.id)) throw new Error('Profile locked')
        setMessage('Synchronization in progress. Uploads and downloads are separate; completion is not yet confirmed.')
        const result = await recovery.continue(item, async () => {
          const fresh = await verifyAccount(item); check()
          if (fresh.scope !== access.scope) throw new Error('Account access changed')
        }, check)
        check(); if (!store.isUnlocked(item.id)) throw new Error('Profile locked')
        const value = await statusReader(item.id); check()
        setStatus(value); setSummary(result); setInterrupted(false)
        setMessage('Transfer attempt finished. Completion and review status are shown separately.')
        globalThis.dispatchEvent(new Event('ministrysprout:sync-complete'))
      } else setMessage('Matching church account verified. Unlock the existing local profile, then continue.')
      if (store.isUnlocked(item.id)) await review(item, current)
    } catch (cause) {
      if (action === 'unlock' && (!current() || !mounted.current)) store.lockProfile(item.id)
      if (!mounted.current) return
      if (action === 'sync') setInterrupted(true)
      if (cause instanceof ProfilePinError) {
        setRetryUntil(Date.parse(cause.retryAfter)); setClock(Date.now()); setPin('')
        setPinError(cause.reason === 'incorrect' ? 'The existing local PIN is incorrect. Encrypted work is unchanged.' : 'The PIN retry delay is active. Wait before trying again.')
      }
      if (current()) {
        let denied = false
        if (!(cause instanceof ProfilePinError)) {
          const records = await store.listProfiles().catch(() => [])
          if (!current()) return
          denied = !!records.find(value => value.id === item.id)?.requiresReauthentication
          if (action !== 'sync' || denied) setSession('unavailable')
        }
        setSummary(null); setStatus(unknownSyncStatus); setServerReview(null)
        if (action === 'sync' && !denied && store.isUnlocked(item.id)) {
          const value = await statusReader(item.id).catch(() => unknownSyncStatus)
          if (!current()) return
          setStatus(value)
        }
        setError(action === 'sync'
          ? 'Synchronization incomplete. Uploaded changes may already be accepted. Verify account access and retry with this existing profile to finish downloads; accepted events will not be recreated.'
          : 'Account access or unlock could not be verified. Keep this profile and browser storage. Check the same account and existing local PIN, then retry.')
        setMessage('')
      }
    } finally { operating.current = false; unlocking.current = false; if (mounted.current) { setBusy(false); setAction(null) } }
  }

  function select(id: string) {
    if (operating.current) return
    if (profile) store.lockProfile(profile.id)
    epoch.current++; setSelected(id); setPin(''); setPinError(''); setError(''); setMessage(''); setSummary(null); setServerReview(null); setStatus(unknownSyncStatus); setSession(online ? 'checking' : 'offline'); setRetryUntil(0); setInterrupted(false)
  }
  async function checkStatus() {
    if (!profile || !store.isUnlocked(profile.id) || operating.current || (session !== 'verified' && session !== 'offline')) return
    operating.current = true; setBusy(true); setAction('status')
    const item = profile, run = epoch.current
    const current = () => mounted.current && run === epoch.current && store.isUnlocked(item.id)
    try {
      const value = await statusReader(item.id).catch(() => unknownSyncStatus)
      if (current()) { setStatus(value); setMessage('Device status checked. No synchronization or attendance was started.') }
      if (current() && session === 'verified') await review(item, current)
    } finally { operating.current = false; if (mounted.current) { setBusy(false); setAction(null) } }
  }
  const visible = unlocked && (session === 'verified' || session === 'offline') ? status : unknownSyncStatus
  const visibleReview = unlocked && session === 'verified' ? serverReview : null
  let headline = busy ? action === 'sync' ? 'Synchronization not complete yet' : action === 'unlock' ? 'Unlocking existing profile…' : action === 'verify' ? 'Checking account access…' : 'Checking device status…' : syncHeadline(visible)
  if (!busy && interrupted && visible.pending === 0 && visible.downloads === 'complete') headline = 'Synchronization interrupted — completion unconfirmed'
  if (!busy && headline === 'Synchronization complete' && visibleReview !== false) headline = visibleReview ? 'Transfers complete — review remains' : 'Transfers complete — server review unknown'
  // Prerequisites describe the current action without exposing protected counts.
  if (!busy && session === 'unavailable') headline = 'Online sign-in required'
  else if (!busy && !unlocked) headline = 'Profile locked'
  else if (!busy && !online && (visible.pending ?? 0) > 0) headline = 'Saved on this device'
  const complete = headline === 'Synchronization complete'
  const transferring = busy && action === 'sync'
  const needsReview = (visible.quarantined ?? 0) > 0 || (visible.reviews ?? 0) > 0 || visibleReview === true
  const tone = complete ? 'success' : interrupted ? 'danger' : transferring || busy ? 'info' : 'warning'
  const description = session === 'unavailable'
    ? 'Sign in with the same church account, unlock this profile, then explicitly continue.'
    : !unlocked ? 'Your encrypted saved work is retained. Use this profile’s original PIN to continue.'
    : !online ? 'Connect to the internet to synchronize. Saved locally is separate from server accepted.'
    : transferring ? 'Uploads and downloads are in progress or awaiting confirmation. Keep this profile open.'
    : interrupted ? 'Saved work is retained. Retry with this profile; existing events and applied download pages are preserved.'
    : complete ? 'No pending uploads. All download pages applied at the last completed synchronization.'
    : needsReview ? 'Transfer does not resolve review. Saved work still needs attention.'
    : visible.pending !== null && visible.pending > 0 ? 'Saved locally; these changes are waiting to upload. Locally finalized attendance is not yet server accepted.'
    : visible.pending === 0 && visible.downloads === 'incomplete' ? 'Your uploads are finished. Continue downloading changes before synchronization is complete.'
    : 'Zero queued uploads alone does not confirm that all downloads were applied.'
  return <section className="sync-screen" aria-labelledby="sync-title">
    <div className="sync-heading"><h1 id="sync-title">Sync &amp; device</h1><p>Saved locally is separate from synchronized.</p></div>
    {!loaded ? <StatusBanner live>Checking existing device profiles…</StatusBanner> : !profiles.length ? <div className="sync-panel"><h2>No device profile available</h2><p>Prepare an encrypted profile after verifying your church access.</p><a href="/account/prepare">Prepare this device</a></div> : <div className="sync-panel">
      <div className="sync-profile-row"><label className="sync-profile-choice"><span className="sr-only">Existing device profile</span><select value={selected} disabled={busy} onChange={event => select(event.target.value)}>{profiles.map((item, index) => <option value={item.id} key={item.id}>Profile {index + 1}</option>)}</select></label><section className="sync-unlock-state"><h3 className="sr-only">Profile unlock</h3><p>{unlocked ? 'Unlocked on this device — authorization checked separately' : 'Locked — encrypted work retained'}</p></section></div>
      <div className={`sync-summary sync-tone-${tone}`} role="status" aria-live="polite" aria-atomic="true"><SyncIcon kind={complete ? 'check' : interrupted ? 'warning' : transferring ? 'sync' : !unlocked ? 'lock' : 'clock'} /><div><h2>{headline}</h2><p>{description}</p></div></div>
      <div className="sync-stages" role="region" aria-label="Transfers">
        <section className={`sync-stage sync-tone-${visible.pending === 0 ? 'success' : 'info'}`}><SyncIcon kind={visible.pending === 0 ? 'check' : transferring ? 'sync' : 'upload'} /><div><h3>Uploads</h3><p>{visible.pending === null ? 'Upload count unavailable' : `${visible.pending} pending uploads`}</p>{summary && <p>{summary.acknowledged} server accepted in this completed attempt</p>}{transferring && <p>{visible.pending === null ? 'Upload progress unknown' : visible.pending > 0 ? 'Sending saved changes or awaiting authorization / receipts…' : 'No queued uploads; downloads still require confirmation.'}</p>}</div></section>
        <section className={`sync-stage sync-tone-${transferring ? 'info' : visible.downloads === 'complete' ? 'success' : visible.downloads === 'incomplete' ? 'warning' : 'info'}`}><SyncIcon kind={transferring ? 'sync' : visible.downloads === 'complete' ? 'check' : visible.downloads === 'incomplete' ? 'clock' : 'download'} /><div><h3>Downloads</h3><p>{transferring ? 'In progress or awaiting authorization — not complete' : visible.downloads === 'incomplete' ? 'Incomplete — continue from the applied cursor' : visible.downloads === 'complete' ? 'All download pages applied at last completed sync' : 'Completion not verified'}</p></div></section>
      </div>
      <section className="sync-recovery" aria-labelledby="sync-recovery-title">
        <h2 id="sync-recovery-title" className="sr-only">Continue safely with this profile</h2>
        {(!unlocked || session === 'unavailable') && <div className="sync-recovery-prerequisites"><ol className="sync-recovery-steps"><li>Verify the same church account.</li><li>Unlock the existing local profile.</li><li>Continue uploads and every download page.</li></ol>
          {!unlocked && <form onSubmit={event => { event.preventDefault(); void act('unlock') }}><Field id="sync-existing-pin" label="Existing local PIN" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={event => setPin(event.target.value)} pattern="[0-9]{6,12}" minLength={6} maxLength={12} required disabled={busy} hint="Use this profile’s existing PIN; church sign-in cannot reset or replace it." error={pinError || undefined} /><Button type="submit" disabled={!online || busy || remaining > 0 || session !== 'verified'}>Unlock existing profile</Button></form>}
          {remaining > 0 && <p role="status">Try the local PIN again in {remaining} seconds. Reloading does not remove the delay.</p>}
        </div>}
        <div className="sync-actions"><Button ref={continueButton} disabled={!online || !unlocked || busy || session !== 'verified'} onClick={() => void act('sync')}><SyncIcon kind="sync" plain />Continue synchronization</Button>{unlocked && <Button variant="secondary" onClick={() => { if (profile) store.lockProfile(profile.id) }}><SyncIcon kind="lock" plain />Lock profile</Button>}</div>
        {!online && <p className="sync-context-note">Connect to the internet, verify the same account, then continue. Your encrypted saved work remains on this device.</p>}
        {session === 'unavailable' && <p className="sync-context-note">Expired or denied sessions require Account verification, email and current-session MFA where required. If access was removed, ask your church Owner; a retry cannot override authorization.</p>}
      </section>
      <div className="sync-access-row"><section><h3 className="sr-only">Church-account session</h3><p>{session === 'verified' ? 'Matching account verified' : session === 'checking' ? 'Checking account access…' : session === 'offline' ? 'Account access not checked while offline' : 'Account verification required'}</p></section><section className="sr-only"><h3>Connection</h3><p>{online ? 'Online — server access checked separately' : 'Offline'}</p></section><div className="sync-tools"><Button variant="secondary" disabled={!online || busy || remaining > 0} onClick={() => void act('verify')}>Verify account access</Button><Button variant="secondary" disabled={!unlocked || busy || (session !== 'verified' && session !== 'offline')} onClick={() => void checkStatus()}>Check device status</Button></div></div>
      <section className={`sync-review${needsReview ? ' sync-tone-warning' : ''}`} aria-labelledby="sync-review-title"><HomeIcon id="info" /><div><h3 id="sync-review-title">Unresolved review</h3><p>{visibleReview === null ? 'Server review status unknown' : visibleReview ? 'Server work needs Owner review' : 'No open server conflict reported at last check'}</p><p>{visible.quarantined === null ? 'Local review count unavailable' : `${visible.quarantined} quarantined ${visible.quarantined === 1 ? 'item' : 'items'} retained on this device`}</p><p>{visible.reviews === null ? 'Downloaded review count unavailable' : `${visible.reviews} downloaded ${visible.reviews === 1 ? 'session needs' : 'sessions need'} review`}</p>{needsReview && <p>Transfer does not resolve review. Retained local items are not automatically cleared by a server decision.</p>}{unlocked && session === 'verified' && needsReview && <a href={profile?.churchId ? `/account/conflicts?church=${encodeURIComponent(profile.churchId)}` : '/account/conflicts'}>Open Review</a>}</div></section>
    </div>}
    {error && <ErrorSummary message={error} />}<div className="sync-support">{message && <StatusBanner live>{message}</StatusBanner>}
    <details className="sync-guidance"><summary><HomeIcon id="info" /><span>Recovery and preservation guidance</span></summary><div><p>Viewing Sync and checking device status do not upload, download or create attendance.</p><p>When a response is lost, server acceptance is uncertain until the existing events are reconciled. Interrupted downloads resume from the last applied page.</p><p>Keep this profile and browser storage. Do not clear site data, remove and recreate this profile, or reset the PIN to recover synchronization. Interrupted retries retain existing events, receipts, applied cursors and quarantined work.</p><p>An expired local authorization requires verified online access and the existing PIN before continuing. Local PIN unlock does not renew church authorization. No profile switch or logout is needed for direct unlock. Church sign-in cannot decrypt a forgotten PIN; ask the Owner for account-access help.</p><a href={accountEntry('/account/login', '/account/sync')}>Check Account / sign in online</a><a href="/profiles">Manage device profiles</a></div></details>
    </div>
  </section>
}

function SyncIcon({ kind, plain = false }: { kind: 'check' | 'clock' | 'sync' | 'lock' | 'upload' | 'download' | 'warning'; plain?: boolean }) {
  const paths = {
    check: 'm6 12 4 4 8-9', clock: 'M12 7v5l3 2', sync: 'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 14-2l1 3M4 15l1 3a8 8 0 0 0 14-2',
    lock: 'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
    upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6', download: 'M12 3v13m-5-5 5 5 5-5M4 15v6h16v-6', warning: 'M12 7v6m0 3h.01',
  }
  return <span className={plain ? 'sync-action-icon' : 'sync-status-icon'} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{['check', 'clock', 'warning'].includes(kind) && <circle cx="12" cy="12" r="9" />}<path d={paths[kind]} /></svg></span>
}
