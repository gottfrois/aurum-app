import { useConvexAuth, useQuery } from 'convex/react'
import * as React from 'react'
import { clearCache } from '~/lib/cache-db'
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
import { api } from '../../convex/_generated/api'

interface EncryptionContextValue {
  isEncryptionEnabled: boolean
  isUnlocked: boolean
  isLoading: boolean
  privateKey: CryptoKey | null
  unlock: (passphrase: string) => Promise<void>
  lock: () => Promise<void>
  hasPersonalKey: boolean
  hasWorkspaceAccess: boolean
  workspacePublicKey: string | null
  role: 'owner' | 'member' | null
  // For granting access: the decrypted workspace private key JWK (in memory only when unlocked via passphrase)
  // Will be null after page reload (non-extractable key in IndexedDB)
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

  // On mount, try to load workspace private key from IndexedDB (non-extractable CryptoKey)
  React.useEffect(() => {
    if (wsEncryption === undefined) return // still loading query
    if (!wsEncryption || !wsEncryption.enabled) {
      setIsLoading(false)
      return
    }
    if (importingRef.current) return
    importingRef.current = true

    getStoredPrivateKey()
      .then((key) => {
        if (key) {
          setPrivateKey(key)
          // workspacePrivateKeyJwk stays null — can't extract from non-extractable key
          // User needs to re-enter passphrase to grant access to other members
        }
      })
      .catch(() => {
        clearStoredPrivateKey()
      })
      .finally(() => {
        setIsLoading(false)
        importingRef.current = false
      })
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

      // Step 3: Import workspace private key as non-extractable and store in IndexedDB
      const wsKey = await importPrivateKey(wsPrivateKeyJwk)
      await storePrivateKey(wsKey) // Store CryptoKey in IndexedDB
      setWorkspacePrivateKeyJwk(wsPrivateKeyJwk) // Keep JWK in memory for granting access
      setPrivateKey(wsKey)
    },
    [wsEncryption],
  )

  const lock = React.useCallback(async () => {
    await clearStoredPrivateKey()
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
  T extends {
    _id: string
    encryptedData?: string
    connectionEncryptedData?: string
  },
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
              // Pass record _id as AAD — decryptData checks version internally
              const data = await decryptData(
                r.encryptedData,
                privateKey!,
                r._id,
              )
              result = { ...result, ...data }
            } catch {
              // keep original
            }
          }
          if (r.connectionEncryptedData) {
            try {
              // connectionEncryptedData uses the connection's _id as AAD, not the record's
              // Since we don't have the connection _id here, pass the record _id
              // The decryptData function only uses AAD for v2 envelopes
              const data = await decryptData(
                r.connectionEncryptedData,
                privateKey!,
                r._id,
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
  T extends {
    _id: string
    encryptedData?: string
    connectionEncryptedData?: string
  },
>(record: T | null | undefined): T | null | undefined {
  const arr = React.useMemo(() => (record ? [record] : undefined), [record])
  const result = useDecryptRecords(arr)
  if (record === null) return null
  if (record === undefined) return undefined
  return result?.[0]
}
