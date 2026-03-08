import * as React from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import {
  clearStoredPrivateKey,
  decryptData,
  decryptPrivateKey as decryptPrivateKeyWithPassphrase,
  deriveKeyFromPassphrase,
  envelopeDecryptString,
  getStoredPrivateKey,
  importPrivateKey,
  storePrivateKey,
} from '~/lib/crypto'
import { clearCache } from '~/lib/cache-db'

interface EncryptionContextValue {
  isEncryptionEnabled: boolean
  isUnlocked: boolean
  isLoading: boolean
  privateKey: CryptoKey | null
  unlock: (passphrase: string) => Promise<void>
  lock: () => void
  hasPersonalKey: boolean
  hasWorkspaceAccess: boolean
  workspacePublicKey: string | null
  role: 'owner' | 'member' | null
  // For granting access: the decrypted workspace private key JWK (in memory only when unlocked)
  workspacePrivateKeyJwk: string | null
}

const EncryptionContext = React.createContext<EncryptionContextValue | null>(
  null,
)

export function EncryptionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated } = useConvexAuth()
  const wsEncryption = useQuery(
    api.encryptionKeys.getWorkspaceEncryption,
    isAuthenticated ? {} : 'skip',
  )

  const [privateKey, setPrivateKey] = React.useState<CryptoKey | null>(null)
  const [workspacePrivateKeyJwk, setWorkspacePrivateKeyJwk] = React.useState<
    string | null
  >(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const importingRef = React.useRef(false)

  const isEncryptionEnabled = wsEncryption?.enabled === true
  const isUnlocked = privateKey !== null
  const hasPersonalKey = wsEncryption?.hasPersonalKey ?? false
  const hasWorkspaceAccess = wsEncryption?.hasKeySlot ?? false

  // On mount, try to load workspace private key from localStorage
  React.useEffect(() => {
    if (wsEncryption === undefined) return // still loading query
    if (!wsEncryption || !wsEncryption.enabled) {
      setIsLoading(false)
      return
    }
    if (importingRef.current) return
    importingRef.current = true

    const stored = getStoredPrivateKey()
    if (stored) {
      importPrivateKey(stored)
        .then((key) => {
          setPrivateKey(key)
          setWorkspacePrivateKeyJwk(stored)
        })
        .catch(() => {
          clearStoredPrivateKey()
        })
        .finally(() => {
          setIsLoading(false)
          importingRef.current = false
        })
    } else {
      setIsLoading(false)
      importingRef.current = false
    }
  }, [wsEncryption])

  const unlock = React.useCallback(
    async (passphrase: string) => {
      if (!wsEncryption) throw new Error('Encryption not enabled')
      if (!wsEncryption.personalKey) throw new Error('No personal key set up')
      if (!wsEncryption.keySlot) throw new Error('No workspace access granted')

      // Step 1: Decrypt personal RSA private key with passphrase
      const salt = Uint8Array.from(
        atob(wsEncryption.personalKey.pbkdf2Salt),
        (c) => c.charCodeAt(0),
      )
      const passphraseKey = await deriveKeyFromPassphrase(passphrase, salt)
      const { ct, iv } = JSON.parse(
        wsEncryption.personalKey.encryptedPrivateKey,
      ) as {
        ct: string
        iv: string
      }
      const personalPrivateKeyJwk = await decryptPrivateKeyWithPassphrase(
        { ct, iv },
        passphraseKey,
      )
      const personalPrivateKey = await importPrivateKey(personalPrivateKeyJwk)

      // Step 2: Decrypt workspace private key using personal private key
      const wsPrivateKeyJwk = await envelopeDecryptString(
        wsEncryption.keySlot.encryptedPrivateKey,
        personalPrivateKey,
      )

      // Step 3: Import workspace private key and store it
      const wsKey = await importPrivateKey(wsPrivateKeyJwk)
      storePrivateKey(wsPrivateKeyJwk)
      setWorkspacePrivateKeyJwk(wsPrivateKeyJwk)
      setPrivateKey(wsKey)
    },
    [wsEncryption],
  )

  const lock = React.useCallback(() => {
    clearStoredPrivateKey()
    setPrivateKey(null)
    setWorkspacePrivateKeyJwk(null)
    clearCache()
  }, [])

  const value = React.useMemo(
    () => ({
      isEncryptionEnabled,
      isUnlocked,
      isLoading,
      privateKey,
      unlock,
      lock,
      hasPersonalKey,
      hasWorkspaceAccess,
      workspacePublicKey: wsEncryption?.workspacePublicKey ?? null,
      role: wsEncryption?.role ?? null,
      workspacePrivateKeyJwk,
    }),
    [
      isEncryptionEnabled,
      isUnlocked,
      isLoading,
      privateKey,
      unlock,
      lock,
      hasPersonalKey,
      hasWorkspaceAccess,
      wsEncryption,
      workspacePrivateKeyJwk,
    ],
  )

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  )
}

export function useEncryption() {
  const ctx = React.useContext(EncryptionContext)
  if (!ctx) {
    throw new Error('useEncryption must be used within EncryptionProvider')
  }
  return ctx
}

// Hook to transparently decrypt records that may have encrypted data
export function useDecryptRecords<
  T extends { encryptedData?: string; connectionEncryptedData?: string },
>(records: Array<T> | undefined): Array<T> | undefined {
  const { privateKey, isEncryptionEnabled, isLoading } = useEncryption()
  const [decrypted, setDecrypted] = React.useState<Array<T> | undefined>(
    undefined,
  )
  const prevRef = React.useRef<{
    records: Array<T> | undefined
    key: CryptoKey | null
  }>({
    records: undefined,
    key: null,
  })

  React.useEffect(() => {
    if (records === undefined) {
      setDecrypted(undefined)
      return
    }

    // No encryption or still loading — pass through
    if (!isEncryptionEnabled || isLoading) {
      setDecrypted(records)
      return
    }

    // No encrypted records — pass through
    const hasEncrypted = records.some(
      (r) => r.encryptedData || r.connectionEncryptedData,
    )
    if (!hasEncrypted) {
      setDecrypted(records)
      return
    }

    // Not unlocked yet — return undefined to show loading
    if (!privateKey) {
      setDecrypted(undefined)
      return
    }

    // Skip if same inputs
    if (
      prevRef.current.records === records &&
      prevRef.current.key === privateKey
    ) {
      return
    }
    prevRef.current = { records, key: privateKey }

    let cancelled = false
    async function run() {
      const results = await Promise.all(
        records!.map(async (r) => {
          let result = r
          if (r.encryptedData) {
            try {
              const data = await decryptData(r.encryptedData, privateKey!)
              result = { ...result, ...data }
            } catch {
              // keep original
            }
          }
          if (r.connectionEncryptedData) {
            try {
              const data = await decryptData(
                r.connectionEncryptedData,
                privateKey!,
              )
              result = { ...result, ...data }
            } catch {
              // keep original
            }
          }
          return result
        }),
      )
      if (!cancelled) setDecrypted(results)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [records, privateKey, isEncryptionEnabled, isLoading])

  return decrypted
}

// Hook to decrypt a single record
export function useDecryptRecord<
  T extends { encryptedData?: string; connectionEncryptedData?: string },
>(record: T | null | undefined): T | null | undefined {
  const arr = React.useMemo(() => (record ? [record] : undefined), [record])
  const result = useDecryptRecords(arr)
  if (record === null) return null
  if (record === undefined) return undefined
  return result?.[0]
}
