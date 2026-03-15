// Web Worker for off-main-thread ECIES decryption
// Receives encrypted records, returns decrypted data

function fromBase64(str: string): ArrayBuffer {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
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

function migratePayload(
  data: Record<string, unknown>,
  _fromVersion: number,
): Record<string, unknown> {
  return data
}

// Cache the imported private key to avoid re-importing on every message
let cachedKeyJwk: string | null = null
let cachedKey: CryptoKey | null = null

async function getPrivateKey(jwk: string): Promise<CryptoKey> {
  if (cachedKeyJwk === jwk && cachedKey) return cachedKey
  cachedKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(jwk),
    { name: 'X25519' },
    false,
    ['deriveBits'],
  )
  cachedKeyJwk = jwk
  return cachedKey
}

async function eciesDecrypt(
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

  const epkRaw = fromBase64(epk)
  const ephemeralPublicKey = await crypto.subtle.importKey(
    'raw',
    epkRaw,
    { name: 'X25519' },
    false,
    [],
  )

  // ECDH → shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'X25519', public: ephemeralPublicKey },
    privateKey,
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
    ['decrypt'],
  )

  // AES-GCM decrypt
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
  const payloadVersion = (parsed._v as number) ?? 0
  const migrated = migratePayload(parsed, payloadVersion)
  delete migrated._v
  return migrated
}

export interface DecryptRequest {
  id: string
  type: 'init' | 'decrypt' | 'decryptFieldGroups'
  privateKeyJwk?: string
  // For single-blob decryption
  encryptedStr?: string
  context?: string
  fieldGroup?: string
  // For field-group decryption
  fields?: Record<string, string | undefined>
  recordId?: string
}

export interface DecryptResponse {
  id: string
  data?: Record<string, unknown>
  error?: string
}

self.onmessage = async (e: MessageEvent<DecryptRequest>) => {
  const req = e.data

  // Handle key initialization — no response needed
  if (req.type === 'init' && req.privateKeyJwk) {
    await getPrivateKey(req.privateKeyJwk)
    return
  }

  try {
    if (!cachedKey) {
      throw new Error('Worker not initialized — call init first')
    }
    const privateKey = cachedKey

    if (req.type === 'decrypt' && req.encryptedStr && req.context) {
      const data = await eciesDecrypt(
        req.encryptedStr,
        privateKey,
        req.context,
        req.fieldGroup,
      )
      self.postMessage({ id: req.id, data } satisfies DecryptResponse)
    } else if (
      req.type === 'decryptFieldGroups' &&
      req.fields &&
      req.recordId
    ) {
      const merged: Record<string, unknown> = {}
      for (const [groupName, encryptedStr] of Object.entries(req.fields)) {
        if (!encryptedStr) continue
        const data = await eciesDecrypt(
          encryptedStr,
          privateKey,
          req.recordId,
          groupName,
        )
        Object.assign(merged, data)
      }
      self.postMessage({ id: req.id, data: merged } satisfies DecryptResponse)
    } else {
      self.postMessage({
        id: req.id,
        error: 'Invalid request',
      } satisfies DecryptResponse)
    }
  } catch (err) {
    self.postMessage({
      id: req.id,
      error: err instanceof Error ? err.message : 'Decryption failed',
    } satisfies DecryptResponse)
  }
}
