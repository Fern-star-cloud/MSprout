import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { authRequest } from '../auth/transport'
import { profileStore, type LocalProfileStore } from '../../offline/profile-store'
import type { OfflineBootstrap, ProfileRecord } from '../../offline/schema'

interface DeviceProfilesScreenProps {
  store?: Pick<LocalProfileStore, 'listProfiles' | 'unlockProfile' | 'switchProfile' | 'createProfile' | 'saveBootstrap' | 'invalidateAuthorization' | 'purgeProfile'>
  onUnlocked?: () => void
}

export function DeviceProfilesScreen({ store = profileStore, onUnlocked }: DeviceProfilesScreenProps) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([])
  const [selected, setSelected] = useState('')
  const [pin, setPin] = useState('')
  const [adding, setAdding] = useState(false)
  const [churchId, setChurchId] = useState(() => new URLSearchParams(globalThis.location?.search ?? '').get('church') ?? '')
  const [newPin, setNewPin] = useState('')
  const [message, setMessage] = useState('')

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
    if (!profile || !profile.churchId || !navigator.onLine) return
    setMessage('')
    try {
      await store.unlockProfile(profile.id, pin)
      const bootstrap = await authRequest<OfflineBootstrap>(`/api/offline/bootstrap?device_id=${profile.deviceId}`, 'GET', undefined, profile.churchId)
      await store.saveBootstrap(profile.id, bootstrap)
      setPin('')
      await refresh()
      setMessage('Authorization refreshed for this profile. Synchronizing pending work…')
      globalThis.dispatchEvent(new Event('online'))
      onUnlocked?.()
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await store.invalidateAuthorization(profile.id)
        await refresh()
      }
      setMessage('Authorization could not be refreshed. Sign in as this profile’s teacher, check the PIN, and try again.')
    }
  }

  return (
    <section className="auth-card device-profiles">
      <p className="eyebrow">Shared device protection</p>
      <h2>Choose a device profile</h2>
      <p>Each teacher&apos;s roster and pending work stay encrypted and separate on this device.</p>
      {profiles.length > 0 ? (
        <form onSubmit={unlock}>
          <fieldset>
            <legend>Profiles on this device</legend>
            {profiles.map((profile, index) => (
              <label className="teacher-choice" key={profile.id}>
                <input type="radio" name="profile" checked={selected === profile.id} onChange={() => setSelected(profile.id)} />
                <span>Profile {index + 1}{profile.requiresReauthentication ? ' — online sign-in required before sync' : ''}</span>
              </label>
            ))}
          </fieldset>
          <label htmlFor="profile-pin">Local PIN</label>
          <input id="profile-pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={pin} onChange={(event) => setPin(event.target.value)} required />
          <p className="privacy-note">This PIN protects this device profile. It is not your church password.</p>
          <button type="submit" disabled={!selected}>Use profile {Math.max(1, profiles.findIndex((profile) => profile.id === selected) + 1)}</button>
          <button className="secondary" type="button" disabled={!selected || !navigator.onLine} onClick={() => void refreshAuthorization()}>Refresh authorization after sign-in</button>
          <button className="secondary" type="button" onClick={() => void purge()}>Remove selected profile</button>
        </form>
      ) : <p>No offline profiles are stored on this device.</p>}
      <button className="secondary" type="button" onClick={() => setAdding((value) => !value)}>Add profile</button>
      {adding && (
        <form onSubmit={add}>
          <h3>Add an encrypted profile</h3>
          <label htmlFor="profile-church">Church ID</label>
          <input id="profile-church" value={churchId} onChange={(event) => setChurchId(event.target.value)} required pattern="[a-fA-F0-9\-]{36}" />
          <label htmlFor="new-profile-pin">Choose a 6–12 digit local PIN</label>
          <input id="new-profile-pin" inputMode="numeric" autoComplete="new-password" type="password" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={newPin} onChange={(event) => setNewPin(event.target.value)} required />
          <button type="submit" disabled={!navigator.onLine}>Download assigned roster and create profile</button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      <p><a href="/account/login">Sign in online</a></p>
    </section>
  )
}
