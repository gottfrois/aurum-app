// Client-side cryptographic utilities for zero-knowledge encryption
// Uses ECIES (X25519 + HKDF + AES-GCM) via Web Crypto API

import Dexie from 'dexie'

// --- Payload versioning ---
export const CURRENT_PAYLOAD_VERSION = 1

export function migratePayload(
  data: Record<string, unknown>,
  _fromVersion: number,
): Record<string, unknown> {
  // v1 is current — no migrations needed yet.
  // Future migrations: if (fromVersion < 2) { ... transform ... }
  return data
}

// --- Base64 helpers ---

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(str: string): ArrayBuffer {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// --- PBKDF2 passphrase derivation (unchanged) ---

const PBKDF2_ITERATIONS = 600_000

export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// --- AES-GCM passphrase-protected private key storage (unchanged) ---

export async function encryptPrivateKey(
  privateKeyJwk: string,
  passphraseKey: CryptoKey,
): Promise<{ ct: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    passphraseKey,
    new TextEncoder().encode(privateKeyJwk),
  )
  return { ct: toBase64(ct), iv: toBase64(iv.buffer) }
}

export async function decryptPrivateKey(
  encrypted: { ct: string; iv: string },
  passphraseKey: CryptoKey,
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(encrypted.iv) },
    passphraseKey,
    fromBase64(encrypted.ct),
  )
  return new TextDecoder().decode(decrypted)
}

// --- X25519 key management ---

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'X25519' }, true, [
    'deriveBits',
  ]) as Promise<CryptoKeyPair>
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key)
  return JSON.stringify(jwk)
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key)
  return JSON.stringify(jwk)
}

export async function importPublicKey(jwkStr: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    JSON.parse(jwkStr),
    { name: 'X25519' },
    true,
    [],
  )
}

export async function importPrivateKey(
  jwkStr: string,
  extractable = false,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    JSON.parse(jwkStr),
    { name: 'X25519' },
    extractable,
    ['deriveBits'],
  )
}

// --- ECIES core: X25519 ECDH + HKDF-SHA256 + AES-GCM-256 ---

async function ecdhDeriveAesKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  ephemeralPublicKeyRaw: ArrayBuffer,
  info: string,
): Promise<CryptoKey> {
  // ECDH → shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'X25519', public: publicKey },
    privateKey,
    256,
  )

  // Import shared secret as HKDF key material
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey'],
  )

  // HKDF → AES-256 key (salt = ephemeral public key, info = context string)
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: ephemeralPublicKeyRaw,
      info: new TextEncoder().encode(info),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function buildHkdfInfo(context: string, fieldGroup?: string): string {
  const parts = ['bunkr-v1', context]
  if (fieldGroup) parts.push(fieldGroup)
  return parts.join('|')
}

function buildAad(
  version: number,
  epkBase64: string,
  context: string,
): Uint8Array {
  return new TextEncoder().encode(`${version}|${epkBase64}|${context}`)
}

// --- ECIES encrypt/decrypt for record data ---

export async function encryptData(
  data: Record<string, unknown>,
  recipientPublicKey: CryptoKey,
  context: string,
  fieldGroup?: string,
): Promise<string> {
  // Generate ephemeral X25519 keypair
  const ephemeral = (await crypto.subtle.generateKey({ name: 'X25519' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair

  const epkRaw = await crypto.subtle.exportKey('raw', ephemeral.publicKey)
  const epkBase64 = toBase64(epkRaw)

  // Derive AES key via ECDH + HKDF
  const info = buildHkdfInfo(context, fieldGroup)
  const aesKey = await ecdhDeriveAesKey(
    ephemeral.privateKey,
    recipientPublicKey,
    epkRaw,
    info,
  )

  // AES-GCM encrypt with AAD
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aad = buildAad(1, epkBase64, context)
  const payload = { _v: CURRENT_PAYLOAD_VERSION, ...data }
  const ct = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: aad as BufferSource,
    },
    aesKey,
    new TextEncoder().encode(JSON.stringify(payload)),
  )

  return JSON.stringify({
    ct: toBase64(ct),
    epk: epkBase64,
    iv: toBase64(iv.buffer),
    v: 1,
  })
}

export async function decryptData(
  encryptedStr: string,
  privateKey: CryptoKey,
  context: string,
  fieldGroup?: string,
): Promise<Record<string, unknown>> {
  const { ct, epk, iv, v } = JSON.parse(encryptedStr) as {
    ct: string
    epk: string
    iv: string
    v: number
  }

  // Import ephemeral public key
  const epkRaw = fromBase64(epk)
  const ephemeralPublicKey = await crypto.subtle.importKey(
    'raw',
    epkRaw,
    { name: 'X25519' },
    false,
    [],
  )

  // Derive same AES key via ECDH + HKDF
  const info = buildHkdfInfo(context, fieldGroup)
  const aesKey = await ecdhDeriveAesKey(
    privateKey,
    ephemeralPublicKey,
    epkRaw,
    info,
  )

  // AES-GCM decrypt with AAD
  const aad = buildAad(v, epk, context)
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(iv),
      additionalData: aad as BufferSource,
    },
    aesKey,
    fromBase64(ct),
  )

  const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as Record<
    string,
    unknown
  >

  // Run payload migration and strip _v
  const payloadVersion = (parsed._v as number) ?? 0
  const migrated = migratePayload(parsed, payloadVersion)
  delete migrated._v
  return migrated
}

// --- ECIES encrypt/decrypt for strings (key slot wrapping) ---

export async function encryptString(
  plaintext: string,
  recipientPublicKey: CryptoKey,
): Promise<string> {
  const ephemeral = (await crypto.subtle.generateKey({ name: 'X25519' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair

  const epkRaw = await crypto.subtle.exportKey('raw', ephemeral.publicKey)
  const epkBase64 = toBase64(epkRaw)

  const info = buildHkdfInfo('keyslot')
  const aesKey = await ecdhDeriveAesKey(
    ephemeral.privateKey,
    recipientPublicKey,
    epkRaw,
    info,
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aad = new TextEncoder().encode(`keyslot|${epkBase64}`)
  const ct = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: aad as BufferSource,
    },
    aesKey,
    new TextEncoder().encode(plaintext),
  )

  return JSON.stringify({
    ct: toBase64(ct),
    epk: epkBase64,
    iv: toBase64(iv.buffer),
  })
}

export async function decryptString(
  encryptedStr: string,
  privateKey: CryptoKey,
): Promise<string> {
  const { ct, epk, iv } = JSON.parse(encryptedStr) as {
    ct: string
    epk: string
    iv: string
  }

  const epkRaw = fromBase64(epk)
  const ephemeralPublicKey = await crypto.subtle.importKey(
    'raw',
    epkRaw,
    { name: 'X25519' },
    false,
    [],
  )

  const info = buildHkdfInfo('keyslot')
  const aesKey = await ecdhDeriveAesKey(
    privateKey,
    ephemeralPublicKey,
    epkRaw,
    info,
  )

  const aad = new TextEncoder().encode(`keyslot|${epk}`)
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(iv),
      additionalData: aad as BufferSource,
    },
    aesKey,
    fromBase64(ct),
  )

  return new TextDecoder().decode(decrypted)
}

// --- Field-group encryption ---

export async function encryptFieldGroups(
  groups: Record<string, Record<string, unknown>>,
  publicKey: CryptoKey,
  recordId: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const [groupName, fields] of Object.entries(groups)) {
    result[groupName] = await encryptData(
      fields,
      publicKey,
      recordId,
      groupName,
    )
  }
  return result
}

export async function decryptFieldGroups(
  encryptedFields: Record<string, string | undefined>,
  privateKey: CryptoKey,
  recordId: string,
): Promise<Record<string, unknown>> {
  const merged: Record<string, unknown> = {}
  for (const [groupName, encryptedStr] of Object.entries(encryptedFields)) {
    if (!encryptedStr) continue
    const data = await decryptData(
      encryptedStr,
      privateKey,
      recordId,
      groupName,
    )
    Object.assign(merged, data)
  }
  return merged
}

// --- IndexedDB-based key storage using Dexie ---

const keyDb = new Dexie('BunkrKeyStore') as Dexie & {
  keys: Dexie.Table<{ id: string; key: CryptoKey }, string>
}
keyDb.version(1).stores({ keys: 'id' })

const WS_KEY_ID = 'workspace-private-key'

export async function getStoredPrivateKey(): Promise<CryptoKey | null> {
  try {
    const row = await keyDb.keys.get(WS_KEY_ID)
    return row?.key ?? null
  } catch {
    return null
  }
}

export async function storePrivateKey(key: CryptoKey): Promise<void> {
  await keyDb.keys.put({ id: WS_KEY_ID, key })
}

export async function clearStoredPrivateKey(): Promise<void> {
  await keyDb.keys.delete(WS_KEY_ID)
}
