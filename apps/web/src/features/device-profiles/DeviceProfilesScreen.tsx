import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { Button, Dialog, ErrorSummary, Field, StatusBanner } from '../../components/ui/Foundations'
import { authRequest } from '../auth/transport'
import { ProfilePinError, profileStore, type LocalProfileStore } from '../../offline/profile-store'
import type { OfflineBootstrap, ProfileRecord } from '../../offline/schema'
import { offlineDatabase } from '../../offline/db'
import { syncClient, type SyncClient } from '../../sync/sync-client'
import { HomeIcon } from '../../components/ui/HomeIcon'
import { Brand } from '../../components/ui/Brand'
import '../../styles/device-profiles.css'

const countPending = (profileId: string) => offlineDatabase.outboxEvents.where('profileId').equals(profileId).count()

interface DeviceProfilesScreenProps {
  store?: Pick<LocalProfileStore, 'listProfiles' | 'unlockProfile' | 'switchProfile' | 'createProfile' | 'saveBootstrap' | 'invalidateAuthorization' | 'isLeaseValid' | 'assessRemoval' | 'purgeProfile' | 'onLock' | 'isUnlocked' | 'lockProfile'>
  synchronizer?: Pick<SyncClient, 'syncProfile'>
  pendingCount?: (profileId: string) => Promise<number>
  onUnlocked?: () => void
}

export function DeviceProfilesScreen({ store = profileStore, synchronizer = syncClient, pendingCount = countPending, onUnlocked }: DeviceProfilesScreenProps) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([])
  const [selected, setSelected] = useState('')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [retryUntil, setRetryUntil] = useState(0)
  const [clock, setClock] = useState(Date.now)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState<{ id: string; count: number } | null>(null)
  const [protectedProfile, setProtectedProfile] = useState<string | null>(null)
  const [authorizationUnavailable, setAuthorizationUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState<string | null>(null)
  const [removal, setRemoval] = useState<{ id: string; label: string } | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [view, setView] = useState<'picker' | 'pin' | 'locked'>('picker')
  const [blockedRemoval, setBlockedRemoval] = useState('')
  const viewHeading = useRef<HTMLHeadingElement>(null)
  const pickerIndex = useRef(0)
  const cancelRemoval = useRef<HTMLButtonElement>(null)
  const operating = useRef(false)
  const epoch = useRef(0)
  const mounted = useRef(true)
  const removeTrigger = useRef<HTMLButtonElement>(null)
  const keepButton = useRef<HTMLButtonElement>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const profile = profiles.find(candidate => candidate.id === selected)
  const label = `Profile ${Math.max(1, profiles.findIndex(candidate => candidate.id === selected) + 1)}`
  const unlocked = !!selected && store.isUnlocked(selected)
  const remaining = Math.max(0, Math.ceil((Math.max(retryUntil, Date.parse(profile?.retryAfter ?? '') || 0) - clock) / 1000))

  const refresh = async () => {
    const values = await store.listProfiles()
    if (mounted.current) {
      setProfiles(values)
      setSelected(current => values.some(value => value.id === current) ? current : values[0]?.id ?? '')
    }
    return values
  }
  useEffect(() => {
    mounted.current = true
    let active = true
    void store.listProfiles().then(values => {
      if (!active) return
      setProfiles(values)
      setSelected(values[0]?.id ?? '')
      setLoaded(true)
    }).catch(() => { if (active) setError('Device profiles could not be read. Keep this browser’s storage and try again.') })
    return () => { active = false; mounted.current = false; epoch.current += 1 }
  }, [store])

  useEffect(() => {
    if (!remaining) return
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [remaining])

  useEffect(() => {
    let active = true
    const generation = epoch.current
    const current = () => active && generation === epoch.current && store.isUnlocked(selected)
    if (unlocked) void store.isLeaseValid(selected).then(async valid => {
      if (!current()) return
      setProtectedProfile(valid ? selected : null)
      setAuthorizationUnavailable(!valid)
      if (!valid) return
      try {
        const count = await pendingCount(selected)
        if (current()) setPending({ id: selected, count })
      } catch {
        // An unreadable queue is unknown work, not proof that the verified lease expired.
        if (current()) setPending(null)
      }
    }).catch(() => { if (current()) { setProtectedProfile(null); setPending(null); setAuthorizationUnavailable(true) } })
    return () => { active = false }
  }, [selected, profiles, pendingCount, store, unlocked])

  useEffect(() => store.onLock((id, reason) => {
    epoch.current += 1
    setPin('')
    setPending(null)
    setProtectedProfile(null)
    setAuthorizationUnavailable(false)
    setCompleted(null)
    setRemoval(null)
    setConfirmation('')
    setBlockedRemoval('')
    setError('')
    setMessage('This device profile is locked. Its encrypted work is kept on this device.')
    if (id === selected && reason !== 'profile_switch' && !operating.current) setView('locked')
  }), [store, selected])

  useEffect(() => {
    if (view === 'pin') document.getElementById('profile-pin')?.focus()
    else if (view === 'locked') viewHeading.current?.focus()
  }, [view])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    globalThis.addEventListener('online', update)
    globalThis.addEventListener('offline', update)
    return () => {
      globalThis.removeEventListener('online', update)
      globalThis.removeEventListener('offline', update)
    }
  }, [])

  const begin = () => {
    if (operating.current) return false
    operating.current = true
    setBusy(true)
    setError('')
    setMessage('')
    setPinError('')
    return true
  }
  const finish = () => { operating.current = false; if (mounted.current) setBusy(false) }
  const failedPin = (cause: unknown) => {
    setPin('')
    if (cause instanceof ProfilePinError) {
      setMessage('')
      setRetryUntil(Date.parse(cause.retryAfter))
      setClock(Date.now())
      setPinError(cause.reason === 'incorrect' ? 'The local PIN is incorrect. Your encrypted work is unchanged.' : 'The retry delay is still active. Wait before trying this PIN again.')
      return true
    }
    return false
  }

  const unlock = async (continueToAttendance: boolean) => {
    if (!selected || remaining || operating.current) return
    if (!/^[0-9]{6,12}$/.test(pin)) {
      setPinError('Enter 6–12 digits. Leading zeros are kept.')
      document.getElementById('profile-pin')?.focus()
      return
    }
    if (!begin()) return
    try {
      await store.switchProfile(selected, pin, {
        online: navigator.onLine,
        signOut: async () => { await authRequest('/logout', 'POST') },
      })
      if (!mounted.current || !store.isUnlocked(selected)) return
      setPin('')
      const generation = epoch.current
      const valid = await store.isLeaseValid(selected)
      if (!mounted.current || generation !== epoch.current || !store.isUnlocked(selected)) return
      setAuthorizationUnavailable(!valid)
      setMessage(valid ? 'Profile unlocked on this device. Sign in to the same church account before synchronizing.' : 'Online sign-in required. The PIN cannot renew expired offline access. Sign in as the same church account, then refresh authorization using this existing PIN.')
      await refresh()
      if (continueToAttendance && valid) onUnlocked?.()
    } catch (cause) {
      if (!failedPin(cause)) setError('This profile could not be unlocked. Keep its encrypted work and try again.')
    } finally { finish() }
  }

  const reviewRemoval = async () => {
    if (!unlocked || !begin()) return
    const generation = epoch.current
    try {
      const assessment = await store.assessRemoval(selected)
      if (generation !== epoch.current || !store.isUnlocked(selected)) return
      if (assessment.status === 'ready') {
        setConfirmation('')
        setRemoval({ id: selected, label })
      } else {
        const reason = assessment.status === 'blocked'
          ? 'Keep this profile. Attendance drafts, pending uploads, or quarantined work remain. An empty upload queue alone does not prove removal is safe.'
          : 'Keep this profile. Removal safety could not be verified. Sign in to the same church account and complete synchronization, then check again. Do not clear browser storage.'
        setBlockedRemoval(reason)
      }
    } catch { setBlockedRemoval('Removal safety could not be verified. Nothing was removed. Keep this profile and try again.') }
    finally { finish() }
  }

  const purge = async () => {
    if (!removal || removal.id !== selected || confirmation !== removal.label || !store.isUnlocked(removal.id) || !begin()) return
    const target = removal
    try {
      await store.purgeProfile(target.id, { confirmedProfileId: target.id })
      setRemoval(null)
      setConfirmation('')
      setPin('')
      setPending(null)
      setCompleted(null)
      setProfiles(current => current.filter(candidate => candidate.id !== target.id))
      setSelected('')
      setView('picker')
      setMessage(`${target.label} was removed from this device. Other profiles are unchanged.`)
      await refresh().catch(() => setError('The selected profile was removed, but the remaining profile list could not be refreshed. Reload to check the list; keep browser storage.'))
    } catch {
      setRemoval(null)
      setConfirmation('')
      setError('Removal was not completed. Keep this profile: its state may have changed or could not be verified. Check again before trying to remove it.')
    } finally { finish() }
  }

  const refreshAuthorization = async () => {
    if (!profile?.churchId || !navigator.onLine || remaining || !begin()) return
    const target = profile
    setCompleted(null)
    setMessage('Refreshing authorization. Synchronization is not complete yet…')
    try {
      await store.unlockProfile(target.id, pin)
      const generation = epoch.current
      const bootstrap = await authRequest<OfflineBootstrap>(`/api/offline/bootstrap?device_id=${target.deviceId}`, 'GET', undefined, target.churchId!)
      if (!mounted.current || generation !== epoch.current || !store.isUnlocked(target.id)) throw new Error('Profile locked')
      await store.saveBootstrap(target.id, bootstrap, { preserveCursor: true })
      setPin('')
      await refresh()
      if (generation !== epoch.current || !store.isUnlocked(target.id)) throw new Error('Profile locked')
      setMessage('Authorization refreshed. Uploading pending work and completing downloads…')
      const summary = await synchronizer.syncProfile(target.id)
      await refresh()
      const count = await pendingCount(target.id)
      if (generation !== epoch.current || !store.isUnlocked(target.id)) throw new Error('Profile locked')
      setPending({ id: target.id, count })
      setCompleted(target.id)
      setMessage(`Synchronization complete. All download pages applied.${summary.conflicts + summary.rejected > 0 ? ' Some uploaded work needs review.' : ''}`)
      globalThis.dispatchEvent(new Event('ministrysprout:sync-complete'))
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        try { await store.invalidateAuthorization(target.id) }
        catch { store.lockProfile(target.id) }
      }
      const current = (await refresh().catch(() => [])).find(candidate => candidate.id === target.id)
      if (failedPin(cause)) setMessage('')
      else if (!store.isUnlocked(target.id)) setMessage('This device profile is locked. Enter its existing PIN after the retry delay. Its encrypted work is kept on this device.')
      else setMessage(current?.requiresReauthentication || (cause instanceof ApiError && [401, 403, 419].includes(cause.status))
        ? 'Online sign-in required. Sign in to this profile’s church account, check account access, and retry. Synchronization is incomplete.'
        : 'Synchronization incomplete. Uploaded changes may already be accepted. Retry here to finish downloads; accepted events will not be recreated.')
      globalThis.dispatchEvent(new Event('ministrysprout:sync-authorization-invalid'))
    } finally { finish() }
  }

  const select = (id: string) => {
    if (operating.current) return
    store.lockProfile(selected)
    epoch.current += 1
    setSelected(id)
    setPin('')
    setPinError('')
    setRetryUntil(0)
    setClock(Date.now())
    setMessage('')
    setError('')
    setCompleted(null)
    setPending(null)
    setProtectedProfile(null)
    setAuthorizationUnavailable(false)
    setRemoval(null)
    setConfirmation('')
    setBlockedRemoval('')
  }

  const openPin = (id: string) => {
    if (operating.current) return
    pickerIndex.current = profiles.findIndex(candidate => candidate.id === id)
    if (selected !== id) select(id)
    setView('pin')
  }
  const showPicker = () => {
    if (operating.current) return
    setPin(''); setPinError(''); setError(''); setMessage(''); setView('picker')
    requestAnimationFrame(() => document.querySelectorAll<HTMLButtonElement>('.profile-picker .ui-button')[pickerIndex.current]?.focus())
  }

  return (
    <div className="device-entry-frame">
      <aside className="device-entry-rail"><Brand /><nav aria-label="Device navigation">
        <a href="/profiles" aria-current="page"><HomeIcon id="home" />Use this device</a>
        <a href="/account/prepare"><HomeIcon id="attendance" />Prepare device</a>
        <a href="/account/sync"><HomeIcon id="sync" />Sync &amp; device</a>
        <a href="#profile-help" onClick={() => { const help = document.getElementById('profile-help'); if (help instanceof HTMLDetailsElement) help.open = true }}><HomeIcon id="info" />Help</a>
      </nav></aside>
      <div className="device-entry-content"><header className="device-entry-header">{view === 'picker' ? <span className="device-entry-label"><HomeIcon id="device" />This device</span> : <Button className="profile-back" variant="secondary" disabled={busy} onClick={showPicker}>‹ Profiles</Button>}<div className="device-entry-brand"><Brand /></div><span className="device-entry-connection" role="status" aria-live="polite" aria-atomic="true" title="Browser connectivity does not confirm server availability or signed-in access."><span className="sr-only">Browser connectivity: </span>{online ? 'Online' : 'Offline'}<span className="sr-only">. This does not confirm server availability or signed-in access.</span></span></header>
    <section className="auth-card device-profiles" data-view={view} aria-busy={busy}>
      {view === 'picker' ? <>
        <header className="profile-page-heading"><h2>Choose a device profile</h2><p>Choose a saved profile or prepare a new one.</p></header>
        {profiles.length > 0 ? <fieldset className="profile-picker" disabled={busy}>
          <legend>Profiles on this device</legend>
          {profiles.map((candidate, index) => <div className="profile-picker-row" key={candidate.id}>
            <span className="profile-icon"><HomeIcon id="device" /></span>
            <label className="profile-choice"><input aria-label={`Profile ${index + 1}`} type="radio" name="profile" checked={selected === candidate.id} onChange={() => select(candidate.id)} /><span>Profile {index + 1}</span><small>{store.isUnlocked(candidate.id) ? 'Unlocked on this device' : 'Locked · Encrypted data hidden'}</small></label>
            <Button onClick={() => openPin(candidate.id)} aria-label={`Use profile ${index + 1}`}>Use profile</Button>
          </div>)}
        </fieldset> : <StatusBanner live>{loaded ? 'No offline profiles are stored on this device.' : 'Checking device profiles…'}</StatusBanner>}
        <div className="profile-picker-row profile-prepare-row"><span className="profile-icon profile-icon-blue" aria-hidden="true">+</span><div><h3>New to this device?</h3><p>Connect and sign in to your church account.</p></div><a className="ui-button ui-button-secondary" href="/account/prepare">Prepare this device</a></div>
        <div className="profile-info"><HomeIcon id="info" /><p>A local PIN unlocks this device. Your church password signs you in online.</p></div>
        <p className="profile-switch-note">Normal profile selection signs out the online church session.</p>
      </> : view === 'locked' ? <div className="profile-lock-panel">
        <span className="profile-icon profile-lock-icon"><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V6a5 5 0 0 1 10 0v4h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Zm2 0h6V6a3 3 0 0 0-6 0Z" /></svg></span><h2 ref={viewHeading} tabIndex={-1}>Profile locked</h2>
        <p>Your saved work is encrypted on this device.</p>
        <Button onClick={() => setView('pin')}>Unlock with PIN</Button><Button variant="secondary" onClick={showPicker}>Choose a profile</Button>
      </div> : <>
        <div className="profile-pin-heading"><span className={`profile-icon profile-lock-icon${pinError ? ' profile-icon-error' : ''}`}>{pinError ? <span aria-hidden="true">!</span> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V6a5 5 0 0 1 10 0v4h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Zm2 0h6V6a3 3 0 0 0-6 0Z" /></svg>}</span><h2>{pinError ? 'PIN not accepted' : unlocked ? `Manage ${label}` : `Unlock ${label}`}</h2></div>
        <form noValidate className="profile-pin-form" onSubmit={event => { event.preventDefault(); void unlock(true) }}>
          <Field id="profile-pin" label="Local PIN" disabled={busy || remaining > 0} type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={pin} onChange={event => setPin(event.target.value)} required hint="6–12 digits. Your PIN unlocks encrypted data on this device." error={pinError || undefined} aria-describedby={remaining ? 'profile-retry' : undefined} />
          {pinError && <div className="profile-pin-announcement" role="alert">{pinError}</div>}
          {remaining > 0 && <p className="profile-retry" id="profile-retry" role="status" aria-live="polite">Try again in {remaining} seconds. The delay also applies after reloading.</p>}
          <Button type="submit" disabled={!selected || busy || remaining > 0} aria-label={`Unlock ${label}`}>Unlock</Button>
          <a className="profile-online-link" href="/account/login" onClick={event => { if (busy) event.preventDefault() }}>Need online sign-in?</a>
          <div className="profile-info"><HomeIcon id="info" /><p>Your local PIN is not your church account password.</p></div>
        </form>
        <details className="profile-recovery" open={unlocked || undefined}>
          <summary>Synchronization recovery</summary>
          <section aria-labelledby="profile-recovery-title">
            <h3 id="profile-recovery-title">Synchronization recovery</h3>
            <p>After signing in to the same church account, enter the existing PIN and synchronize here. This keeps you on Profiles and does not create attendance.</p>
            {unlocked && protectedProfile === selected && <StatusBanner live tone="info">{pending?.id !== selected ? 'Pending uploads: unavailable or checking' : `${pending.count} pending uploads`}{profile?.syncNeedsPull ? ' · Downloads incomplete' : completed === selected ? ' · Downloads complete' : ' · Download completion requires a successful sync'}</StatusBanner>}
            {unlocked && authorizationUnavailable && <div className="profile-online-required"><HomeIcon id="sync" /><h3>Online sign-in required</h3><p>Protected status is unavailable until offline authorization is verified. If authorization expired, sign in online and refresh it using the existing PIN.</p><a className="ui-button" href="/account/login">Sign in online</a></div>}
            {unlocked && !authorizationUnavailable && protectedProfile !== selected && <p>Checking protected offline authorization…</p>}
            {!unlocked && <p>Unlock this profile to view its synchronization status.</p>}
            <Button disabled={!selected || !online || busy || remaining > 0} onClick={() => void refreshAuthorization()}>Refresh authorization and sync</Button>
            {!online && <p>Connect and sign in to the same church account before synchronizing.</p>}
          </section>
        </details>
        <details className="profile-management" open={unlocked || undefined}>
          <summary>Manage this device profile</summary>
          <section aria-labelledby="profile-management-title"><h3 id="profile-management-title">Manage this device profile</h3>
            {!unlocked && <Button variant="secondary" disabled={busy || remaining > 0 || !/^[0-9]{6,12}$/.test(pin)} onClick={() => void unlock(false)}>Unlock to manage profile</Button>}
            {unlocked && <Button variant="secondary" disabled={busy} onClick={() => store.lockProfile(selected)}>Lock profile</Button>}
            <p id="profile-removal-help">Removal is allowed only after its local work is verified safe. Attendance drafts, pending uploads, quarantined work, or uncertain storage prevent removal.</p>
            <Button ref={removeTrigger} variant="secondary" disabled={!unlocked || busy} aria-describedby="profile-removal-help" onClick={() => void reviewRemoval()}>Remove selected profile</Button>
            {!unlocked && <p>Unlock the selected profile before checking removal safety.</p>}
          </section>
        </details>
      </>}
      <details className="profile-guidance" id="profile-help">
        <summary>Forgot your PIN or unable to unlock?</summary>
        <p>Use the existing local PIN. Church sign-in cannot reset it or decrypt this profile. There is no PIN-reset shortcut.</p>
        <p>Resetting your online church password does not decrypt existing locally encrypted work.</p>
        <p>Keep this profile and browser storage. Do not clear site data, uninstall to recover access, or remove and recreate the profile: encrypted work may be lost. Ask your church Owner for account-access help; they cannot recover the local PIN.</p>
        <p>An expired offline authorization needs an online sign-in to the same church account and an authorization refresh using the existing PIN. Entering the PIN alone cannot renew access.</p>
        <p>Locking, switching profiles, backgrounding the app, or inactivity hides protected data. Locking keeps encrypted work on this device.</p>
      </details>
      {error && <ErrorSummary message={error} />}
      {message && <StatusBanner live>{message}</StatusBanner>}
      {blockedRemoval && <Dialog open title="This profile cannot be removed" description="Pending or unverified saved work could be lost. Removal stays blocked until local work is verified safe." onClose={() => setBlockedRemoval('')} initialFocus={cancelRemoval} returnFocus={removeTrigger}>
        <div className="profile-blocked-icon" aria-hidden="true">!</div><ErrorSummary message={blockedRemoval} />
        <div className="profile-actions"><a className="ui-button" href="/account/sync">Open Sync</a><Button ref={cancelRemoval} variant="secondary" onClick={() => setBlockedRemoval('')}>Cancel</Button></div>
      </Dialog>}
      {removal && <Dialog open title={`Remove ${removal.label}?`} description={`This permanently removes ${removal.label} and its encryption key, downloaded cache, authorization and synchronization cursor from this browser. It does not delete church-account records or other device profiles. This cannot be undone.`} onClose={() => { if (!busy) setRemoval(null) }} initialFocus={keepButton} returnFocus={removeTrigger}>
        <p>Safety will be checked again when you confirm. If local work appears or safety becomes uncertain, removal will stop.</p>
        <Field label={`Type ${removal.label} to confirm`} value={confirmation} autoComplete="off" disabled={busy} onChange={event => setConfirmation(event.target.value)} />
        <div className="profile-actions"><Button ref={keepButton} variant="secondary" disabled={busy} onClick={() => setRemoval(null)}>Keep profile</Button><Button variant="danger" disabled={busy || confirmation !== removal.label} onClick={() => void purge()}>Permanently remove {removal.label}</Button></div>
      </Dialog>}
    </section>
      </div>
    </div>
  )
}
