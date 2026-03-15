// Server-side ECIES encryption using Web Crypto API (available in Convex action runtime)
// Only import this from actions/httpActions — NOT from queries/mutations

const CURRENT_PAYLOAD_VERSION = 1

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
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
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(publicKeyJwk),
    { name: 'X25519' },
    false,
    [],
  )

  // Generate ephemeral X25519 keypair
  const ephemeral = (await crypto.subtle.generateKey({ name: 'X25519' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair

  const epkRaw = await crypto.subtle.exportKey('raw', ephemeral.publicKey)
  const epkBase64 = toBase64(epkRaw)

  // ECDH → shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'X25519', public: publicKey },
    ephemeral.privateKey,
    256,
  )

  // HKDF → AES key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey'],
  )
  const info = buildHkdfInfo(context, fieldGroup)
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: epkRaw,
      info: new TextEncoder().encode(info),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )

  // AES-GCM encrypt with AAD
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aad = buildAad(1, epkBase64, context)
  const ct = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: aad as BufferSource,
    },
    aesKey,
    plaintext as BufferSource,
  )

  return JSON.stringify({
    ct: toBase64(ct),
    epk: epkBase64,
    iv: toBase64(iv.buffer as ArrayBuffer),
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
