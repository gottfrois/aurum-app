import { useConvexAuth, useQuery } from 'convex/react'
import * as React from 'react'
import { clearCache } from '~/lib/cache-db'
import {
  clearStoredPrivateKey,
  decryptData,
  decryptFieldGroups,
  decryptPrivateKey as decryptPrivateKeyWithPassphrase,
  decryptString,
  deriveKeyFromPassphrase,
  exportPrivateKey,
  getStoredPrivateKey,
  importPrivateKey,
  storePrivateKey,
} from '~/lib/crypto'
import {
  decryptFieldGroupsViaWorker,
  decryptViaWorker,
  initWorkerKey,
  isWorkerAvailable,
} from '~/lib/worker-pool'
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
  // JWK for Web Workers (available when key is extractable)
  workerKeyJwk: string | null
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
  // JWK for passing to Web Workers (set on mount from extractable key or on unlock)
  const [workerKeyJwk, setWorkerKeyJwk] = React.useState<string | null>(null)
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
      .then(async (key) => {
        if (key) {
          setPrivateKey(key)
          // Try to export JWK for workers (only works if key was stored as extractable)
          try {
            const jwk = await exportPrivateKey(key)
            setWorkerKeyJwk(jwk)
            if (isWorkerAvailable()) initWorkerKey(jwk)
          } catch {
            // Key is non-extractable (old storage) — workers will fall back to main thread
          }
          // workspacePrivateKeyJwk stays null — user needs to re-enter passphrase for granting access
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

      // Step 1: Decrypt personal private key with passphrase
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

      // Step 2: Decrypt workspace private key using personal private key (ECIES)
      const wsPrivateKeyJwk = await decryptString(
        wsEncryption.keySlot.encryptedPrivateKey,
        personalPrivateKey,
      )

      // Step 3: Import workspace private key (extractable for workers) and store in IndexedDB
      const wsKey = await importPrivateKey(wsPrivateKeyJwk, true)
      await storePrivateKey(wsKey) // Store CryptoKey in IndexedDB
      setWorkspacePrivateKeyJwk(wsPrivateKeyJwk) // Keep JWK in memory for granting access
      setWorkerKeyJwk(wsPrivateKeyJwk) // Keep JWK for Web Workers
      if (isWorkerAvailable()) initWorkerKey(wsPrivateKeyJwk)
      setPrivateKey(wsKey)
    },
    [wsEncryption],
  )

  const lock = React.useCallback(async () => {
    await clearStoredPrivateKey()
    setPrivateKey(null)
    setWorkspacePrivateKeyJwk(null)
    setWorkerKeyJwk(null)
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
      workerKeyJwk,
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
      workerKeyJwk,
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

// Encrypted field names used to detect if a record needs decryption
const ENCRYPTED_FIELD_NAMES = [
  'encryptedData',
  'connectionEncryptedData',
  'encryptedIdentity',
  'encryptedBalance',
  'encryptedDetails',
  'encryptedFinancials',
  'encryptedCategories',
  'encryptedValuation',
] as const

// Field-group names (subset that use field-group decryption)
const FIELD_GROUP_NAMES = [
  'encryptedIdentity',
  'encryptedBalance',
  'encryptedDetails',
  'encryptedFinancials',
  'encryptedCategories',
  'encryptedValuation',
] as const

function hasAnyEncryptedField(r: Record<string, unknown>): boolean {
  return ENCRYPTED_FIELD_NAMES.some((f) => typeof r[f] === 'string')
}

// Hook to transparently decrypt records that may have encrypted data
export function useDecryptRecords<
  T extends {
    _id: string
    encryptedData?: string
    connectionEncryptedData?: string
    encryptedIdentity?: string
    encryptedBalance?: string
    encryptedDetails?: string
    encryptedFinancials?: string
    encryptedCategories?: string
    encryptedValuation?: string
  },
>(records: Array<T> | undefined): Array<T> | undefined {
  const { privateKey, isEncryptionEnabled, isLoading, workerKeyJwk } =
    useEncryption()
  const useWorkers = isWorkerAvailable() && workerKeyJwk !== null
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
    const hasEncrypted = records.some((r) =>
      hasAnyEncryptedField(r as unknown as Record<string, unknown>),
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
    const key = privateKey
    const recs = records
    async function run() {
      const results = await Promise.all(
        recs.map(async (r) => {
          let result = r

          // Single-blob encrypted fields (connections, balance snapshots)
          if (r.encryptedData) {
            try {
              const data = useWorkers
                ? await decryptViaWorker(r.encryptedData, r._id)
                : await decryptData(r.encryptedData, key, r._id)
              result = { ...result, ...data }
            } catch {
              // keep original
            }
          }
          if (r.connectionEncryptedData) {
            try {
              const data = useWorkers
                ? await decryptViaWorker(r.connectionEncryptedData, r._id)
                : await decryptData(r.connectionEncryptedData, key, r._id)
              result = { ...result, ...data }
            } catch {
              // keep original
            }
          }

          // Field-group encrypted fields
          const fieldGroupEntries: Record<string, string | undefined> = {}
          for (const name of FIELD_GROUP_NAMES) {
            const val = (r as Record<string, unknown>)[name]
            if (typeof val === 'string') {
              fieldGroupEntries[name] = val
            }
          }
          if (Object.keys(fieldGroupEntries).length > 0) {
            try {
              const data = useWorkers
                ? await decryptFieldGroupsViaWorker(fieldGroupEntries, r._id)
                : await decryptFieldGroups(fieldGroupEntries, key, r._id)
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
  }, [records, privateKey, isEncryptionEnabled, isLoading, useWorkers])

  return decrypted
}

// Hook to decrypt a single record
export function useDecryptRecord<
  T extends {
    _id: string
    encryptedData?: string
    connectionEncryptedData?: string
    encryptedIdentity?: string
    encryptedBalance?: string
    encryptedDetails?: string
    encryptedFinancials?: string
    encryptedCategories?: string
    encryptedValuation?: string
  },
>(record: T | null | undefined): T | null | undefined {
  const arr = React.useMemo(() => (record ? [record] : undefined), [record])
  const result = useDecryptRecords(arr)
  if (record === null) return null
  if (record === undefined) return undefined
  return result?.[0]
}
