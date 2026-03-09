// Client-side cryptographic utilities for zero-knowledge encryption
// Uses Web Crypto API (available in all modern browsers)

import Dexie from 'dexie'

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

const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 4096,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}

const PBKDF2_ITERATIONS = 600_000

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(RSA_PARAMS, true, ['encrypt', 'decrypt'])
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
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt'],
  )
}

export async function importPrivateKey(jwkStr: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    JSON.parse(jwkStr),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false, // non-extractable
    ['decrypt'],
  )
}

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

// Envelope encryption: AES-GCM data key wrapped with RSA-OAEP public key
// With optional AAD (Additional Authenticated Data) for v2 envelopes
export async function encryptData(
  data: Record<string, unknown>,
  publicKey: CryptoKey,
  aad?: string,
): Promise<string> {
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt'],
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aesParams: AesGcmParams = { name: 'AES-GCM', iv: iv as BufferSource }
  if (aad) {
    aesParams.additionalData = new TextEncoder().encode(aad)
  }
  const ct = await crypto.subtle.encrypt(
    aesParams,
    aesKey,
    new TextEncoder().encode(JSON.stringify(data)),
  )
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey)
  const ek = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawAesKey,
  )
  return JSON.stringify({
    ct: toBase64(ct),
    ek: toBase64(ek),
    iv: toBase64(iv.buffer),
    v: aad ? 2 : 1,
  })
}

export async function decryptData(
  encryptedStr: string,
  privateKey: CryptoKey,
  aad?: string,
): Promise<Record<string, unknown>> {
  const { ct, ek, iv, v } = JSON.parse(encryptedStr) as {
    ct: string
    ek: string
    iv: string
    v?: number
  }
  const rawAesKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    fromBase64(ek),
  )
  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const aesParams: AesGcmParams = { name: 'AES-GCM', iv: fromBase64(iv) }
  if (v === 2 && aad) {
    aesParams.additionalData = new TextEncoder().encode(aad)
  }
  const decrypted = await crypto.subtle.decrypt(aesParams, aesKey, fromBase64(ct))
  return JSON.parse(new TextDecoder().decode(decrypted))
}

// Envelope-encrypt a string (e.g. workspace private key JWK) for a recipient's RSA public key
export async function envelopeEncryptString(
  plaintext: string,
  recipientPublicKey: CryptoKey,
): Promise<string> {
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt'],
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    aesKey,
    new TextEncoder().encode(plaintext),
  )
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey)
  const ek = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPublicKey,
    rawAesKey,
  )
  return JSON.stringify({
    ct: toBase64(ct),
    ek: toBase64(ek),
    iv: toBase64(iv.buffer),
  })
}

// Decrypt an envelope-encrypted string using recipient's RSA private key
export async function envelopeDecryptString(
  encryptedStr: string,
  privateKey: CryptoKey,
): Promise<string> {
  const { ct, ek, iv } = JSON.parse(encryptedStr) as {
    ct: string
    ek: string
    iv: string
  }
  const rawAesKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    fromBase64(ek),
  )
  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    aesKey,
    fromBase64(ct),
  )
  return new TextDecoder().decode(decrypted)
}

// IndexedDB-based key storage using Dexie (non-extractable CryptoKey)
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
