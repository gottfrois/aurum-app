import * as React from 'react'
import {
  useDecryptRecord,
  useDecryptRecords,
} from '~/contexts/encryption-context'
import type { CachedRecord } from '~/lib/cache-db'
import { cacheDb } from '~/lib/cache-db'

interface HasId {
  _id: string
  encryptedData?: string
  connectionEncryptedData?: string
  encryptedIdentity?: string
  encryptedBalance?: string
  encryptedDetails?: string
  encryptedFinancials?: string
  encryptedCategories?: string
  encryptedValuation?: string
}

/**
 * Cache-aware wrapper around useDecryptRecords.
 * Returns cached decrypted data from IndexedDB instantly,
 * then updates when fresh decrypted data arrives from Convex.
 */
export function useCachedDecryptRecords<T extends HasId>(
  tableName: string,
  rawRecords: Array<T> | undefined,
): Array<T> | undefined {
  const decrypted = useDecryptRecords(rawRecords)
  const [cached, setCached] = React.useState<Array<T> | undefined>(undefined)
  const cacheLoadedRef = React.useRef(false)

  // Load cached records on mount / when rawRecords change
  React.useEffect(() => {
    if (!rawRecords || rawRecords.length === 0) {
      setCached(undefined)
      cacheLoadedRef.current = false
      return
    }

    const ids = rawRecords.map((r) => r._id)
    cacheDb.records
      .where('_id')
      .anyOf(ids)
      .toArray()
      .then((rows) => {
        if (rows.length > 0) {
          const rowMap = new Map(rows.map((r) => [r._id, r]))
          const restored = ids
            .map((id) => rowMap.get(id))
            .filter((r): r is NonNullable<typeof r> => r != null)
          if (restored.length > 0) {
            setCached(restored as unknown as Array<T>)
          }
        }
        cacheLoadedRef.current = true
      })
      .catch(() => {
        cacheLoadedRef.current = true
      })
  }, [rawRecords])

  // Write fresh decrypted data to cache
  React.useEffect(() => {
    if (!decrypted || decrypted.length === 0) return

    const now = Date.now()
    const records: Array<CachedRecord> = decrypted.map((r) => ({
      ...(r as unknown as Record<string, unknown>),
      _id: r._id,
      _table: tableName,
      _cachedAt: now,
    }))
    cacheDb.records.bulkPut(records).catch(() => {
      // IndexedDB write failed — non-critical
    })

    setCached(decrypted)
  }, [decrypted, tableName])

  // Return fresh decrypted if available, then cached, then undefined
  if (decrypted !== undefined) return decrypted
  if (cached !== undefined) return cached
  return undefined
}

/**
 * Cache-aware wrapper around useDecryptRecord (single record).
 */
export function useCachedDecryptRecord<T extends HasId>(
  tableName: string,
  rawRecord: T | null | undefined,
): T | null | undefined {
  const decryptedRecord = useDecryptRecord(rawRecord)
  const [cached, setCached] = React.useState<T | null | undefined>(undefined)

  // Load from cache
  React.useEffect(() => {
    if (!rawRecord) {
      setCached(rawRecord)
      return
    }

    cacheDb.records
      .get(rawRecord._id)
      .then((row) => {
        if (row) {
          setCached(row as unknown as T)
        }
      })
      .catch(() => {
        // non-critical
      })
  }, [rawRecord])

  // Write fresh decrypted to cache
  React.useEffect(() => {
    if (!decryptedRecord) return

    const record: CachedRecord = {
      ...(decryptedRecord as unknown as Record<string, unknown>),
      _id: decryptedRecord._id,
      _table: tableName,
      _cachedAt: Date.now(),
    }
    cacheDb.records.put(record).catch(() => {
      // non-critical
    })

    setCached(decryptedRecord)
  }, [decryptedRecord, tableName])

  if (rawRecord === null) return null
  if (decryptedRecord !== undefined) return decryptedRecord
  if (cached !== undefined) return cached
  return undefined
}
