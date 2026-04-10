import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { CreateViewForm } from '~/components/create-view-form'
import type { Filter } from '~/components/reui/filters'
import { SiteHeader } from '~/components/site-header'
import type { CashFlowTab } from '~/components/transactions-content'
import { TransactionsContent } from '~/components/transactions-content'
import { deserializeFilters, serializeFilters } from '~/lib/filters/serialize'

const STORAGE_KEY = 'bunkr:filters:cash-flow'

const VALID_TABS: ReadonlyArray<CashFlowTab> = ['all', 'expenses', 'income']

export const Route = createFileRoute('/_app/cash-flow')({
  component: CashFlowPage,
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    createView?: boolean
    viewScope?: string
    tab?: CashFlowTab
  } => ({
    createView: search.createView === true ? true : undefined,
    viewScope:
      typeof search.viewScope === 'string' ? search.viewScope : undefined,
    tab:
      typeof search.tab === 'string' &&
      VALID_TABS.includes(search.tab as CashFlowTab)
        ? (search.tab as CashFlowTab)
        : undefined,
  }),
})

function CashFlowPage() {
  const { t } = useTranslation()
  const { createView, viewScope, tab } = Route.useSearch()
  const navigate = useNavigate()

  const activeTab: CashFlowTab = tab ?? 'all'

  const initialFilters = React.useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? deserializeFilters(stored) : []
    } catch {
      return []
    }
  }, [])

  const filtersRef = React.useRef<Array<Filter>>(initialFilters)

  const handleFiltersChange = React.useCallback((next: Array<Filter>) => {
    filtersRef.current = next
    try {
      if (next.length > 0) {
        localStorage.setItem(STORAGE_KEY, serializeFilters(next))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // Storage full or unavailable
    }
  }, [])

  const handleCancelCreateView = React.useCallback(() => {
    navigate({ to: '/cash-flow', search: {} })
  }, [navigate])

  const handleTabChange = React.useCallback(
    (next: CashFlowTab) => {
      navigate({
        to: '/cash-flow',
        search: (prev) => ({
          ...prev,
          tab: next === 'all' ? undefined : next,
        }),
      })
    },
    [navigate],
  )

  return (
    <>
      <SiteHeader title={t('nav.cashFlow')} />
      <div className="flex flex-1 flex-col">
        {createView && (
          <CreateViewForm
            getFilters={() => filtersRef.current}
            entityType="transactions"
            defaultScope={viewScope}
            onCancel={handleCancelCreateView}
          />
        )}
        <TransactionsContent
          initialFilters={initialFilters}
          onFiltersChange={handleFiltersChange}
          tab={activeTab}
          onTabChange={handleTabChange}
        />
      </div>
    </>
  )
}
