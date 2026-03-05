import * as React from 'react'
import { useConvexAuth, useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id, Doc } from '../../convex/_generated/dataModel'

interface AccountContextValue {
  accounts: Doc<'accounts'>[] | undefined
  activeAccountId: Id<'accounts'> | null
  activeAccount: Doc<'accounts'> | undefined
  setActiveAccountId: (id: Id<'accounts'>) => void
  isLoading: boolean
}

const AccountContext = React.createContext<AccountContextValue | null>(null)

const STORAGE_KEY = 'aurum-active-account-id'

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()
  const accounts = useQuery(
    api.accounts.listAccounts,
    isAuthenticated ? {} : 'skip',
  )
  const ensureWorkspace = useMutation(api.workspaces.ensureWorkspace)
  const [activeAccountId, setActiveAccountIdState] =
    React.useState<Id<'accounts'> | null>(null)
  const bootstrapping = React.useRef(false)

  // Bootstrap workspace once Convex auth is ready and we see no accounts
  React.useEffect(() => {
    if (!isAuthenticated) return
    if (accounts === undefined) return
    if (accounts.length > 0) return
    if (bootstrapping.current) return

    bootstrapping.current = true
    ensureWorkspace()
      .catch(() => {
        bootstrapping.current = false
      })
  }, [isAuthenticated, accounts, ensureWorkspace])

  // Set initial active account from localStorage or first account
  React.useEffect(() => {
    if (!accounts || accounts.length === 0) return

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && accounts.some((a) => a._id === stored)) {
      setActiveAccountIdState(stored as Id<'accounts'>)
    } else {
      setActiveAccountIdState(accounts[0]._id)
    }
  }, [accounts])

  const setActiveAccountId = React.useCallback((id: Id<'accounts'>) => {
    setActiveAccountIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const activeAccount = accounts?.find((a) => a._id === activeAccountId)

  const isLoading =
    isAuthLoading || (isAuthenticated && (!accounts || accounts.length === 0))

  return (
    <AccountContext.Provider
      value={{
        accounts,
        activeAccountId,
        activeAccount,
        setActiveAccountId,
        isLoading,
      }}
    >
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const ctx = React.useContext(AccountContext)
  if (!ctx) {
    throw new Error('useAccount must be used within an AccountProvider')
  }
  return ctx
}
