import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { CreateViewForm } from '~/components/create-view-form'
import type { Filter } from '~/components/reui/filters'
import { SiteHeader } from '~/components/site-header'
import { TransactionsContent } from '~/components/transactions-content'
import { deserializeFilters, serializeFilters } from '~/lib/filters/serialize'

const STORAGE_KEY = 'bunkr:filters:transactions'

export const Route = createFileRoute('/_app/transactions')({
  component: TransactionsPage,
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { createView?: boolean; viewScope?: string } => ({
    createView: search.createView === true ? true : undefined,
    viewScope:
      typeof search.viewScope === 'string' ? search.viewScope : undefined,
  }),
})

function TransactionsPage() {
  const { createView, viewScope } = Route.useSearch()
  const navigate = useNavigate()

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
    navigate({ to: '/transactions', search: {} })
  }, [navigate])

  return (
    <>
      <SiteHeader />
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
        />
      </div>
    </>
  )
}
