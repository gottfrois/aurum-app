export const LIST_PREFS_STORAGE_KEY = 'bunkr:list-prefs'

export const TRANSACTIONS_PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export type TransactionsPageSize =
  (typeof TRANSACTIONS_PAGE_SIZE_OPTIONS)[number]

export interface StoredListPrefs {
  transactionsPageSize: TransactionsPageSize
  /** Schema version, bump on breaking changes */
  _v?: number
}

const DEFAULT: StoredListPrefs = {
  transactionsPageSize: 25,
  _v: 1,
}

function isValidPageSize(value: unknown): value is TransactionsPageSize {
  return (
    typeof value === 'number' &&
    (TRANSACTIONS_PAGE_SIZE_OPTIONS as readonly number[]).includes(value)
  )
}

export function loadListPrefs(): StoredListPrefs {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = window.localStorage.getItem(LIST_PREFS_STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<StoredListPrefs>
    return {
      transactionsPageSize: isValidPageSize(parsed.transactionsPageSize)
        ? parsed.transactionsPageSize
        : DEFAULT.transactionsPageSize,
      _v: parsed._v ?? DEFAULT._v,
    }
  } catch {
    return DEFAULT
  }
}

export function saveListPrefs(prefs: StoredListPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LIST_PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage full or unavailable
  }
}
