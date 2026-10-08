import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { authRequest } from '../auth/transport'
import { profileStore, type LocalProfileStore } from '../../offline/profile-store'
import type { OfflineBootstrap, ProfileRecord } from '../../offline/schema'
import { offlineDatabase } from '../../offline/db'
import { syncClient, type SyncClient } from '../../sync/sync-client'

const countPending = (profileId: string) => offlineDatabase.outboxEvents.where('profileId').equals(profileId).count()

interface DeviceProfilesScreenProps {
  store?: Pick<LocalProfileStore, 'listProfiles' | 'unlockProfile' | 'switchProfile' | 'createProfile' | 'saveBootstrap' | 'invalidateAuthorization' | 'purgeProfile' | 'onLock' | 'isUnlocked' | 'lockProfile'>
  synchronizer?: Pick<SyncClient, 'syncProfile'>
  pendingCount?: (profileId: string) => Promise<number>
  onUnlocked?: () => void
}

export function DeviceProfilesScreen({ store = profileStore, synchronizer = syncClient, pendingCount = countPending, onUnlocked }: DeviceProfilesScreenProps) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([])
  const [selected, setSelected] = useState('')
  const [pin, setPin] = useState('')
  const [adding, setAdding] = useState(false)
  const [churchId, setChurchId] = useState(() => new URLSearchParams(globalThis.location?.search ?? '').get('church') ?? '')
  const [newPin, setNewPin] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState<string | null>(null)
  const recovering = useRef(false)
  const [online, setOnline] = useState(navigator.onLine)

  const refresh = async () => {
    const values = await store.listProfiles()
    setProfiles(values)
    setSelected((current) => current || values[0]?.id || '')
  }
  useEffect(() => {
    let active = true
    void store.listProfiles().then((values) => {
      if (!active) return
      setProfiles(values)
      setSelected(values[0]?.id ?? '')
    })
    return () => { active = false }
  }, [store])

  useEffect(() => {
    let active = true
    if (selected) void pendingCount(selected).then(value => { if (active) setPending(value) }).catch(() => { if (active) setPending(null) })
    return () => { active = false }
  }, [selected, profiles, pendingCount])

  useEffect(() => store.onLock(() => {
    setPin('')
    setCompleted(null)
    setMessage('This device profile is locked. Enter its existing PIN to recover synchronization after sign-in.')
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

  const unlock = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    try {
      await store.switchProfile(selected, pin, {
        online: navigator.onLine,
        signOut: async () => { await authRequest('/logout', 'POST') },
      })
      setPin('')
      setMessage(navigator.onLine ? 'Profile unlocked. Sign in as this teacher before synchronizing.' : 'Profile unlocked offline. Sign in before synchronizing.')
      onUnlocked?.()
    } catch {
      setMessage('This profile could not be unlocked. Check the PIN or wait before trying again.')
    }
  }

  const add = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    try {
      const deviceId = crypto.randomUUID()
      const bootstrap = await authRequest<OfflineBootstrap>(`/api/offline/bootstrap?device_id=${deviceId}`, 'GET', undefined, churchId)
      const profile = await store.createProfile({ actorId: bootstrap.actor.id, churchId, pin: newPin, deviceId })
      await store.unlockProfile(profile.id, newPin)
      await store.saveBootstrap(profile.id, bootstrap)
      setAdding(false)
      setNewPin('')
      await refresh()
      setSelected(profile.id)
      setMessage('Encrypted device profile created and ready offline.')
      onUnlocked?.()
    } catch {
      setMessage('Connect, sign in to this church, and check the profile details before trying again.')
    }
  }

  const purge = async () => {
    if (!selected) return
    await store.purgeProfile(selected)
    setSelected('')
    setPin('')
    setMessage('The selected local profile was removed from this device.')
    await refresh()
  }

  const refreshAuthorization = async () => {
    const profile = profiles.find((candidate) => candidate.id === selected)
    if (!profile || !profile.churchId || !navigator.onLine || recovering.current) return
    recovering.current = true
    setBusy(true)
    setCompleted(null)
    setMessage('Refreshing authorization. Synchronization is not complete yet…')
    try {
      await store.unlockProfile(profile.id, pin)
      const bootstrap = await authRequest<OfflineBootstrap>(`/api/offline/bootstrap?device_id=${profile.deviceId}`, 'GET', undefined, profile.churchId)
      await store.saveBootstrap(profile.id, bootstrap, { preserveCursor: true })
      setPin('')
      await refresh()
      setMessage('Authorization refreshed. Uploading pending work and completing downloads…')
      const summary = await synchronizer.syncProfile(profile.id)
      await refresh()
      setPending(await pendingCount(profile.id))
      if (!store.isUnlocked(profile.id)) throw new Error('This profile is locked.')
      setCompleted(profile.id)
      setMessage(`Synchronization complete. All download pages applied.${summary.conflicts + summary.rejected > 0 ? ' Some uploaded work needs review.' : ''}`)
      globalThis.dispatchEvent(new Event('ministrysprout:sync-complete'))
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        try { await store.invalidateAuthorization(profile.id) }
        catch { store.lockProfile(profile.id) }
      }
      const values = await store.listProfiles().catch(() => profiles)
      setProfiles(values)
      setPending(await pendingCount(profile.id).catch(() => null))
      const current = values.find(candidate => candidate.id === profile.id)
      setMessage(!store.isUnlocked(profile.id)
        ? 'This device profile is locked or the PIN was not accepted. Enter its existing PIN and retry after sign-in. Synchronization is incomplete.'
        : current?.requiresReauthentication || (error instanceof ApiError && [401, 403, 419].includes(error.status))
          ? 'Online sign-in required. Sign in as this profile’s teacher, check account access, and retry. Synchronization is incomplete.'
          : 'Synchronization incomplete. Uploaded changes may already be accepted. Retry here to finish downloads; accepted events will not be recreated.')
      globalThis.dispatchEvent(new Event('ministrysprout:sync-authorization-invalid'))
    } finally {
      recovering.current = false
      setBusy(false)
    }
  }

  return (
    <section className="auth-card device-profiles">
      <p className="eyebrow">Shared device protection</p>
      <h2>Choose a device profile</h2>
      <p>Each teacher&apos;s roster and pending work stay encrypted and separate on this device.</p>
      {profiles.length > 0 ? (
        <form onSubmit={unlock}>
          <fieldset disabled={busy}>
            <legend>Profiles on this device</legend>
            {profiles.map((profile, index) => (
              <label className="teacher-choice" key={profile.id}>
                <input type="radio" name="profile" checked={selected === profile.id} onChange={() => { setSelected(profile.id); setPin(''); setMessage(''); setCompleted(null); setPending(null) }} />
                <span>Profile {index + 1}{profile.requiresReauthentication ? ' — online sign-in required before sync' : ''}</span>
              </label>
            ))}
          </fieldset>
          <label htmlFor="profile-pin">Local PIN</label>
          <input id="profile-pin" disabled={busy} type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={pin} onChange={(event) => setPin(event.target.value)} required />
          <p className="privacy-note">This PIN protects this device profile. It is not your church password.</p>
          <button type="submit" disabled={!selected || busy}>Use profile {Math.max(1, profiles.findIndex((profile) => profile.id === selected) + 1)}</button>
          <h3>Synchronization recovery</h3>
          <p>After signing in as this teacher, enter the existing PIN and synchronize here. This keeps you on Profiles and does not create attendance.</p>
          <p role="status">{pending === null ? 'Pending uploads: unavailable or checking' : `${pending} pending uploads`}{profiles.find(profile => profile.id === selected)?.syncNeedsPull ? ' · Downloads incomplete' : completed === selected ? ' · Downloads complete' : ' · Download completion requires a successful sync'}</p>
          <button type="button" disabled={!selected || !online || busy} onClick={() => void refreshAuthorization()}>Refresh authorization and sync</button>
          {!online && <p>Connect and sign in as this teacher before synchronizing.</p>}
          <button className="secondary" type="button" disabled={busy} onClick={() => void purge()}>Remove selected profile</button>
        </form>
      ) : <p>No offline profiles are stored on this device.</p>}
      <button className="secondary" type="button" disabled={busy} onClick={() => setAdding((value) => !value)}>Add profile</button>
      {adding && (
        <form onSubmit={add}>
          <h3>Add an encrypted profile</h3>
          <label htmlFor="profile-church">Church ID</label>
          <input id="profile-church" value={churchId} onChange={(event) => setChurchId(event.target.value)} required pattern="[a-fA-F0-9\-]{36}" />
          <label htmlFor="new-profile-pin">Choose a 6–12 digit local PIN</label>
          <input id="new-profile-pin" inputMode="numeric" autoComplete="new-password" type="password" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={newPin} onChange={(event) => setNewPin(event.target.value)} required />
          <button type="submit" disabled={!online || busy}>Download assigned roster and create profile</button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      <p><a href="/account/login" onClick={event => { if (busy) event.preventDefault() }}>Sign in online</a></p>
    </section>
  )
}
