import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  ItemCard,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { Input } from '~/components/ui/input'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute(
  '/_settings/settings/portfolios/$id/general',
)({
  component: PortfolioGeneralPage,
})

function PortfolioGeneralPage() {
  const { id } = Route.useParams()
  const portfolio = useQuery(api.portfolios.getPortfolio, {
    portfolioId: id as Id<'portfolios'>,
  })

  if (portfolio === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <Skeleton className="h-9 w-32" />
        <div className="mt-8 space-y-6">
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!portfolio) return null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <PageHeader
        title="General"
        description="Portfolio name and general settings."
      />
      <div className="mt-8 space-y-6">
        <PortfolioNameCard portfolioId={portfolio._id} name={portfolio.name} />
      </div>
    </div>
  )
}

function PortfolioNameCard({
  portfolioId,
  name,
}: {
  portfolioId: Id<'portfolios'>
  name: string
}) {
  const updatePortfolio = useMutation(api.portfolios.updatePortfolio)
  const [portfolioName, setPortfolioName] = useState(name)
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    const trimmed = portfolioName.trim()
    if (trimmed === name) return

    if (!trimmed) {
      setPortfolioName(name)
      toast.error('Portfolio name cannot be empty')
      return
    }

    setSaving(true)
    try {
      await updatePortfolio({ portfolioId, name: trimmed })
      toast.success('Portfolio name updated')
    } catch {
      setPortfolioName(name)
      toast.error('Failed to update portfolio name')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ItemCard>
      <ItemCardItems>
        <ItemCardItem>
          <ItemCardItemContent>
            <ItemCardItemTitle>Portfolio name</ItemCardItemTitle>
          </ItemCardItemContent>
          <ItemCardItemAction>
            <Input
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              disabled={saving}
              className="h-8 w-48 text-sm"
            />
          </ItemCardItemAction>
        </ItemCardItem>
      </ItemCardItems>
    </ItemCard>
  )
}
