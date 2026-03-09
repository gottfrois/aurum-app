// Server-side encryption using Web Crypto API (available in Convex action runtime)
// Only import this from actions/httpActions — NOT from queries/mutations

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export async function encryptForProfile(
  data: Record<string, unknown>,
  publicKeyJwk: string,
  aad?: string,
): Promise<string> {
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(publicKeyJwk),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt'],
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aesParams: AesGcmParams = { name: 'AES-GCM', iv }
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
