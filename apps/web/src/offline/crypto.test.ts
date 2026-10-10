import { describe, expect, it } from 'vitest'
import {
  createProfileKeyMaterial,
  decryptPayload,
  encryptPayload,
  unwrapDataKey,
} from './crypto'

describe('offline profile encryption', () => {
  it('preserves a leading-zero PIN as a string through real key wrapping', async () => {
    const material = await createProfileKeyMaterial('leading-zero-profile', '000123')
    await expect(unwrapDataKey('leading-zero-profile', '000123', material)).resolves.toBeDefined()
    await expect(unwrapDataKey('leading-zero-profile', '123', material)).rejects.toThrow()
  })
  it('cannot decrypt one teacher profile with another profile PIN', async () => {
    const first = await createProfileKeyMaterial('profile-a', '184629')
    const second = await createProfileKeyMaterial('profile-b', '934175')
    const firstKey = await unwrapDataKey('profile-a', '184629', first)
    const secondKey = await unwrapDataKey('profile-b', '934175', second)
    const encrypted = await encryptPayload('profile-a', 'roster', firstKey, [{ id: 'student-a', displayName: 'Ana' }])

    await expect(decryptPayload('profile-a', 'roster', secondKey, encrypted)).rejects.toThrow()
  })

  it('rejects an incorrect PIN and authenticates ciphertext to its profile and schema', async () => {
    const material = await createProfileKeyMaterial('profile-a', '184629')
    await expect(unwrapDataKey('profile-a', '184620', material)).rejects.toThrow()

    const key = await unwrapDataKey('profile-a', '184629', material)
    const encrypted = await encryptPayload('profile-a', 'roster', key, { students: [] })
    await expect(decryptPayload('profile-b', 'roster', key, encrypted)).rejects.toThrow()
  })
})
