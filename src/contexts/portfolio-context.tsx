import { useConvexAuth, useQuery } from 'convex/react'
import * as React from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

type ActivePortfolioId = Id<'portfolios'> | 'all' | 'family' | null

interface PortfolioContextValue {
  portfolios: Array<Doc<'portfolios'>> | undefined
  activePortfolioId: ActivePortfolioId
  activePortfolio: Doc<'portfolios'> | undefined
  setActivePortfolioId: (id: Id<'portfolios'> | 'all' | 'family') => void
  isAllPortfolios: boolean
  isFamilyView: boolean
  allPortfolioIds: Array<Id<'portfolios'>>
  /** activePortfolioId when a single portfolio is selected, null otherwise */
  singlePortfolioId: Id<'portfolios'> | null
  isLoading: boolean
}

const PortfolioContext = React.createContext<PortfolioContextValue | null>(null)

const STORAGE_KEY = 'bunkr-active-portfolio-id'

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()
  const portfolios = useQuery(
    api.portfolios.listPortfolios,
    isAuthenticated ? {} : 'skip',
  )
  const [activePortfolioId, setActivePortfolioIdState] =
    React.useState<ActivePortfolioId>(null)

  // Set initial active portfolio from localStorage or first portfolio
  React.useEffect(() => {
    if (!portfolios || portfolios.length === 0) return

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'all') {
      setActivePortfolioIdState('all')
    } else if (stored === 'family') {
      setActivePortfolioIdState('family')
    } else if (stored && portfolios.some((p) => p._id === stored)) {
      setActivePortfolioIdState(stored as Id<'portfolios'>)
    } else {
      setActivePortfolioIdState(portfolios[0]._id)
    }
  }, [portfolios])

  const setActivePortfolioId = React.useCallback(
    (id: Id<'portfolios'> | 'all' | 'family') => {
      setActivePortfolioIdState(id)
      localStorage.setItem(STORAGE_KEY, id)
    },
    [],
  )

  const isAllPortfolios = activePortfolioId === 'all'
  const isFamilyView = activePortfolioId === 'family'
  const singlePortfolioId: Id<'portfolios'> | null =
    activePortfolioId &&
    activePortfolioId !== 'all' &&
    activePortfolioId !== 'family'
      ? activePortfolioId
      : null
  const activePortfolio =
    isAllPortfolios || isFamilyView
      ? undefined
      : portfolios?.find((p) => p._id === activePortfolioId)

  const allPortfolioIds = React.useMemo(
    () => portfolios?.map((p) => p._id) ?? [],
    [portfolios],
  )

  const isLoading =
    isAuthLoading || (isAuthenticated && portfolios === undefined)

  return (
    <PortfolioContext.Provider
      value={{
        portfolios,
        activePortfolioId,
        activePortfolio,
        setActivePortfolioId,
        isLoading,
        isAllPortfolios,
        isFamilyView,
        allPortfolioIds,
        singlePortfolioId,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  const ctx = React.useContext(PortfolioContext)
  if (!ctx) {
    throw new Error('usePortfolio must be used within a PortfolioProvider')
  }
  return ctx
}
