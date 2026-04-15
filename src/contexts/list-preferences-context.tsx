import * as React from 'react'
import {
  LIST_PREFS_STORAGE_KEY,
  loadListPrefs,
  type StoredListPrefs,
  saveListPrefs,
  type TransactionsPageSize,
} from '~/lib/list-prefs/storage'

export interface ListPreferences {
  transactionsPageSize: TransactionsPageSize
}

interface ListPreferencesContextValue extends ListPreferences {
  setTransactionsPageSize: (size: TransactionsPageSize) => void
}

const ListPreferencesContext =
  React.createContext<ListPreferencesContextValue | null>(null)

export function ListPreferencesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [stored, setStored] = React.useState<StoredListPrefs>(() =>
    loadListPrefs(),
  )

  // Cross-tab sync
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LIST_PREFS_STORAGE_KEY || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue) as StoredListPrefs
        setStored(parsed)
      } catch {
        // Ignore corrupted payloads
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const updateStored = React.useCallback((patch: Partial<StoredListPrefs>) => {
    setStored((prev) => {
      const next = { ...prev, ...patch }
      saveListPrefs(next)
      return next
    })
  }, [])

  const setTransactionsPageSize = React.useCallback(
    (size: TransactionsPageSize) =>
      updateStored({ transactionsPageSize: size }),
    [updateStored],
  )

  const value = React.useMemo<ListPreferencesContextValue>(
    () => ({
      transactionsPageSize: stored.transactionsPageSize,
      setTransactionsPageSize,
    }),
    [stored.transactionsPageSize, setTransactionsPageSize],
  )

  return (
    <ListPreferencesContext.Provider value={value}>
      {children}
    </ListPreferencesContext.Provider>
  )
}

export function useListPreferences(): ListPreferencesContextValue {
  const ctx = React.useContext(ListPreferencesContext)
  if (!ctx) {
    throw new Error(
      'useListPreferences must be used within a ListPreferencesProvider',
    )
  }
  return ctx
}
