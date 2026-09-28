import {
  OFFLINE_SCHEMA_VERSION,
  PBKDF2_ITERATIONS,
  type EncryptedEnvelope,
  type ProfileKeyMaterial,
} from './schema'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function associatedData(profileId: string, purpose: string, schemaVersion = OFFLINE_SCHEMA_VERSION) {
  return encoder.encode(`MinistrySprout:${profileId}:${schemaVersion}:${purpose}`)
}

async function wrappingKey(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  if (!/^\d{6,12}$/.test(pin)) throw new Error('The local PIN must contain 6 to 12 digits.')
  if (iterations < PBKDF2_ITERATIONS) throw new Error('The profile key derivation is not strong enough.')
  const material = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptBytes(profileId: string, purpose: string, key: CryptoKey, plaintext: Uint8Array<ArrayBuffer>): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: associatedData(profileId, purpose), tagLength: 128 },
    key,
    plaintext,
  )
  return { algorithm: 'AES-256-GCM', iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)), schemaVersion: OFFLINE_SCHEMA_VERSION }
}

async function decryptBytes(profileId: string, purpose: string, key: CryptoKey, envelope: EncryptedEnvelope): Promise<ArrayBuffer> {
  if (envelope.algorithm !== 'AES-256-GCM' || envelope.schemaVersion !== OFFLINE_SCHEMA_VERSION) {
    throw new Error('Unsupported encrypted profile data.')
  }
  return crypto.subtle.decrypt(
    {
      name: 'AES-GCM', iv: fromBase64(envelope.iv),
      additionalData: associatedData(profileId, purpose, envelope.schemaVersion), tagLength: 128,
    },
    key,
    fromBase64(envelope.ciphertext),
  )
}

export async function createProfileKeyMaterial(profileId: string, pin: string): Promise<ProfileKeyMaterial> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await wrappingKey(pin, salt, PBKDF2_ITERATIONS)
  const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', generated))
  try {
    return {
      salt: toBase64(salt),
      iterations: PBKDF2_ITERATIONS,
      wrappedDataKey: await encryptBytes(profileId, 'wrapped-data-key', derived, raw),
    }
  } finally {
    raw.fill(0)
  }
}

export async function unwrapDataKey(profileId: string, pin: string, material: ProfileKeyMaterial): Promise<CryptoKey> {
  const derived = await wrappingKey(pin, fromBase64(material.salt), material.iterations)
  const raw = new Uint8Array(await decryptBytes(profileId, 'wrapped-data-key', derived, material.wrappedDataKey))
  try {
    return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  } finally {
    raw.fill(0)
  }
}

export async function encryptPayload(profileId: string, purpose: string, key: CryptoKey, payload: unknown): Promise<EncryptedEnvelope> {
  return encryptBytes(profileId, purpose, key, encoder.encode(JSON.stringify(payload)))
}

export async function decryptPayload<T>(profileId: string, purpose: string, key: CryptoKey, envelope: EncryptedEnvelope): Promise<T> {
  const plaintext = await decryptBytes(profileId, purpose, key, envelope)
  return JSON.parse(decoder.decode(plaintext)) as T
}
