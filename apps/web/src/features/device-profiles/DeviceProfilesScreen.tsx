import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { Button, Dialog, ErrorSummary, Field, StatusBadge, StatusBanner } from '../../components/ui/Foundations'
import { authRequest } from '../auth/transport'
import { ProfilePinError, profileStore, type LocalProfileStore } from '../../offline/profile-store'
import type { OfflineBootstrap, ProfileRecord } from '../../offline/schema'
import { offlineDatabase } from '../../offline/db'
import { syncClient, type SyncClient } from '../../sync/sync-client'

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
  const [adding, setAdding] = useState(false)
  const [churchId, setChurchId] = useState(() => new URLSearchParams(globalThis.location?.search ?? '').get('church') ?? '')
  const [newPin, setNewPin] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState<{ id: string; count: number } | null>(null)
  const [protectedProfile, setProtectedProfile] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState<string | null>(null)
  const [removal, setRemoval] = useState<{ id: string; label: string } | null>(null)
  const [confirmation, setConfirmation] = useState('')
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
      if (!valid) return
      const count = await pendingCount(selected)
      if (current()) setPending({ id: selected, count })
    }).catch(() => { if (current()) { setProtectedProfile(null); setPending(null) } })
    return () => { active = false }
  }, [selected, profiles, pendingCount, store, unlocked])

  useEffect(() => store.onLock(() => {
    epoch.current += 1
    setPin('')
    setNewPin('')
    setPending(null)
    setProtectedProfile(null)
    setCompleted(null)
    setRemoval(null)
    setConfirmation('')
    setError('')
    setMessage('This device profile is locked. Its encrypted work is kept on this device.')
  }), [store])

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
      setRetryUntil(Date.parse(cause.retryAfter))
      setClock(Date.now())
      setPinError(cause.reason === 'incorrect' ? 'The local PIN is incorrect. Your encrypted work is unchanged.' : 'The retry delay is still active. Wait before trying this PIN again.')
      return true
    }
    return false
  }

  const unlock = async (continueToAttendance: boolean) => {
    if (!selected || remaining || !begin()) return
    try {
      await store.switchProfile(selected, pin, {
        online: navigator.onLine,
        signOut: async () => { await authRequest('/logout', 'POST') },
      })
      if (!mounted.current || !store.isUnlocked(selected)) return
      setPin('')
      setMessage('Profile unlocked on this device. Sign in as this teacher before synchronizing.')
      await refresh()
      if (continueToAttendance) onUnlocked?.()
    } catch (cause) {
      if (!failedPin(cause)) setError('This profile could not be unlocked. Keep its encrypted work and try again.')
    } finally { finish() }
  }

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!begin()) return
    try {
      const deviceId = crypto.randomUUID()
      const bootstrap = await authRequest<OfflineBootstrap>(`/api/offline/bootstrap?device_id=${deviceId}`, 'GET', undefined, churchId)
      const created = await store.createProfile({ actorId: bootstrap.actor.id, churchId, pin: newPin, deviceId })
      await store.unlockProfile(created.id, newPin)
      await store.saveBootstrap(created.id, bootstrap)
      setAdding(false)
      setNewPin('')
      await refresh()
      setSelected(created.id)
      setMessage('Encrypted device profile created and ready offline.')
      onUnlocked?.()
    } catch {
      setError('Preparation could not be completed. Keep any existing profile and encrypted work. Connect, sign in to this church, and check access before retrying.')
      await refresh().catch(() => undefined)
    } finally { setNewPin(''); finish() }
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
        setError(assessment.status === 'blocked'
          ? 'Keep this profile. Attendance drafts, pending uploads, or quarantined work remain. An empty upload queue alone does not prove removal is safe.'
          : 'Keep this profile. Removal safety could not be verified. Sign in as this teacher and complete synchronization, then check again. Do not clear browser storage.')
      }
    } catch { setError('Removal safety could not be verified. Nothing was removed. Keep this profile and try again.') }
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
        ? 'Online sign-in required. Sign in as this profile’s teacher, check account access, and retry. Synchronization is incomplete.'
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
    setRemoval(null)
    setConfirmation('')
  }

  return (
    <section className="auth-card device-profiles">
      <p className="eyebrow">Shared device protection</p>
      <h2>Choose a device profile</h2>
      <p>Each teacher&apos;s roster and local work stay encrypted and separate on this device.</p>
      {profiles.length > 0 ? <>
        <form onSubmit={event => { event.preventDefault(); void unlock(true) }}>
          <fieldset disabled={busy}>
            <legend>Profiles on this device</legend>
            {profiles.map((candidate, index) => <label className="teacher-choice" key={candidate.id}>
              <input type="radio" name="profile" checked={selected === candidate.id} onChange={() => select(candidate.id)} />
              <span>Profile {index + 1}</span>
            </label>)}
          </fieldset>
          <StatusBadge tone={unlocked ? 'info' : 'neutral'}>{unlocked ? 'Unlocked on this device' : 'Locked — encrypted data hidden'}</StatusBadge>
          <Field id="profile-pin" label="Local PIN" disabled={busy} type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={pin} onChange={event => setPin(event.target.value)} required hint="This PIN protects this device profile. It is not your church password." error={pinError || undefined} aria-describedby={remaining ? 'profile-retry' : undefined} />
          {pinError && <ErrorSummary message={pinError} errors={[{ target: 'profile-pin', message: 'Check the local PIN' }]} />}
          {remaining > 0 && <p id="profile-retry" role="status" aria-live="polite">Try again in {remaining} seconds. The delay also applies after reloading.</p>}
          <div className="profile-actions">
            <Button type="submit" disabled={!selected || busy || remaining > 0}>Use profile {Math.max(1, profiles.findIndex(candidate => candidate.id === selected) + 1)}</Button>
            {!unlocked && <Button variant="secondary" disabled={busy || remaining > 0 || !/^[0-9]{6,12}$/.test(pin)} onClick={() => void unlock(false)}>Unlock to manage profile</Button>}
            {unlocked && <Button variant="secondary" onClick={() => store.lockProfile(selected)}>Lock profile</Button>}
          </div>
        </form>
        <section aria-labelledby="profile-recovery-title">
          <h3 id="profile-recovery-title">Synchronization recovery</h3>
          <p>After signing in as this teacher, enter the existing PIN and synchronize here. This keeps you on Profiles and does not create attendance.</p>
          {unlocked && protectedProfile === selected && <StatusBanner live tone="info">{pending?.id !== selected ? 'Pending uploads: unavailable or checking' : `${pending.count} pending uploads`}{profile?.syncNeedsPull ? ' · Downloads incomplete' : completed === selected ? ' · Downloads complete' : ' · Download completion requires a successful sync'}</StatusBanner>}
          {unlocked && protectedProfile !== selected && <p>Protected status is unavailable until offline authorization is verified. If authorization expired, sign in online and refresh it using the existing PIN.</p>}
          {!unlocked && <p>Unlock this profile to view its synchronization status.</p>}
          <Button disabled={!selected || !online || busy || remaining > 0} onClick={() => void refreshAuthorization()}>Refresh authorization and sync</Button>
          {!online && <p>Connect and sign in as this teacher before synchronizing.</p>}
        </section>
        <section aria-labelledby="profile-management-title">
          <h3 id="profile-management-title">Manage this device profile</h3>
          <p id="profile-removal-help">Removal is allowed only after its local work is verified safe. Attendance drafts, pending uploads, quarantined work, or uncertain storage prevent removal.</p>
          <Button ref={removeTrigger} variant="secondary" disabled={!unlocked || busy} aria-describedby="profile-removal-help" onClick={() => void reviewRemoval()}>Remove selected profile</Button>
          {!unlocked && <p>Unlock the selected profile before checking removal safety.</p>}
        </section>
      </> : <p>{loaded ? 'No offline profiles are stored on this device.' : 'Checking device profiles…'}</p>}
      <details className="profile-guidance">
        <summary>Forgot your PIN or unable to unlock?</summary>
        <p>Use the existing local PIN. Church sign-in cannot reset it or decrypt this profile. There is no PIN-reset shortcut.</p>
        <p>Keep this profile and browser storage. Do not clear site data, uninstall to recover access, or remove and recreate the profile: encrypted work may be lost. Ask your church Owner for account-access help; they cannot recover the local PIN.</p>
        <p>An expired offline authorization needs an online sign-in as the same teacher and an authorization refresh using the existing PIN. Entering the PIN alone cannot renew access.</p>
        <p>Locking, switching profiles, backgrounding the app, or inactivity hides protected data. Locking keeps encrypted work on this device.</p>
      </details>
      <Button variant="secondary" disabled={busy} onClick={() => setAdding(value => !value)}>Add profile</Button>
      {adding && <form onSubmit={add}>
        <h3>Add an encrypted profile</h3>
        <Field id="profile-church" label="Church ID" disabled={busy} value={churchId} onChange={event => setChurchId(event.target.value)} required pattern="[a-fA-F0-9\-]{36}" />
        <Field id="new-profile-pin" label="Choose a 6–12 digit local PIN" disabled={busy} inputMode="numeric" autoComplete="new-password" type="password" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={newPin} onChange={event => setNewPin(event.target.value)} required />
        <Button type="submit" disabled={!online || busy}>Download assigned roster and create profile</Button>
      </form>}
      {error && <ErrorSummary message={error} />}
      {message && <StatusBanner live>{message}</StatusBanner>}
      <p><a href="/account/login" onClick={event => { if (busy) event.preventDefault() }}>Sign in online</a></p>
      {removal && <Dialog open title={`Remove ${removal.label}?`} description={`This permanently removes ${removal.label} and its encryption key, downloaded cache, authorization and synchronization cursor from this browser. It does not delete church-account records or other device profiles. This cannot be undone.`} onClose={() => { if (!busy) setRemoval(null) }} initialFocus={keepButton} returnFocus={removeTrigger}>
        <p>Safety will be checked again when you confirm. If local work appears or safety becomes uncertain, removal will stop.</p>
        <Field label={`Type ${removal.label} to confirm`} value={confirmation} autoComplete="off" disabled={busy} onChange={event => setConfirmation(event.target.value)} />
        <div className="profile-actions">
          <Button ref={keepButton} variant="secondary" disabled={busy} onClick={() => setRemoval(null)}>Keep profile</Button>
          <Button variant="danger" disabled={busy || confirmation !== removal.label} onClick={() => void purge()}>Permanently remove {removal.label}</Button>
        </div>
      </Dialog>}
    </section>
  )
}
