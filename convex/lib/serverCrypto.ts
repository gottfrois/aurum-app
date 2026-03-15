// Server-side ECIES encryption using pure-JS @noble/* libraries.
// Convex's default runtime does not support crypto.subtle for X25519, HKDF,
// or AES-GCM, so we use @noble/curves, @noble/hashes, and @noble/ciphers.
// Only import this from actions/httpActions — NOT from queries/mutations

import { gcm } from '@noble/ciphers/aes.js'
import { x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha256.js'

const CURRENT_PAYLOAD_VERSION = 1

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
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

async function eciesEncrypt(
  plaintext: Uint8Array,
  publicKeyJwk: string,
  context: string,
  fieldGroup?: string,
): Promise<string> {
  // Extract raw public key bytes from JWK
  const jwk = JSON.parse(publicKeyJwk) as { x: string }
  const recipientPubBytes = base64urlToBytes(jwk.x)

  // Generate ephemeral X25519 keypair
  const ephemeralPrivateKey = x25519.utils.randomSecretKey()
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey)

  const epkBase64 = toBase64(ephemeralPublicKey)

  // ECDH → shared secret
  const sharedSecret = x25519.getSharedSecret(
    ephemeralPrivateKey,
    recipientPubBytes,
  )

  // HKDF → AES key (32 bytes for AES-256)
  const info = buildHkdfInfo(context, fieldGroup)
  const aesKeyBytes = hkdf(
    sha256,
    sharedSecret,
    ephemeralPublicKey,
    new TextEncoder().encode(info),
    32,
  )

  // AES-GCM encrypt with AAD
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aad = buildAad(1, epkBase64, context)
  const cipher = gcm(aesKeyBytes, iv, aad)
  const ct = cipher.encrypt(plaintext)

  return JSON.stringify({
    ct: toBase64(ct),
    epk: epkBase64,
    iv: toBase64(iv),
    v: 1,
  })
}

export async function encryptForProfile(
  data: Record<string, unknown>,
  publicKeyJwk: string,
  context: string,
  fieldGroup?: string,
): Promise<string> {
  const payload = { _v: CURRENT_PAYLOAD_VERSION, ...data }
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  return eciesEncrypt(plaintext, publicKeyJwk, context, fieldGroup)
}

export async function encryptFieldGroups(
  groups: Record<string, Record<string, unknown>>,
  publicKeyJwk: string,
  recordId: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const [groupName, fields] of Object.entries(groups)) {
    result[groupName] = await encryptForProfile(
      fields,
      publicKeyJwk,
      recordId,
      groupName,
    )
  }
  return result
}
