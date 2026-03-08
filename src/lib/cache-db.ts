import Dexie from 'dexie'

interface CachedRecord {
  _id: string
  _table: string
  _cachedAt: number
  [key: string]: unknown
}

const cacheDb = new Dexie('BunkrCache') as Dexie & {
  records: Dexie.Table<CachedRecord, string>
}

cacheDb.version(1).stores({
  records: '_id, _table',
})

export { cacheDb }
export type { CachedRecord }

export async function clearCache(): Promise<void> {
  await cacheDb.records.clear()
}
