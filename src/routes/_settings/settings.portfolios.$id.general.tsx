import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
        title={t('settings.portfolioGeneral.title')}
        description={t('settings.portfolioGeneral.description')}
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
  const { t } = useTranslation()
  const updatePortfolio = useMutation(api.portfolios.updatePortfolio)
  const [portfolioName, setPortfolioName] = useState(name)
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    const trimmed = portfolioName.trim()
    if (trimmed === name) return

    if (!trimmed) {
      setPortfolioName(name)
      toast.error(t('toast.portfolioNameCannotBeEmpty'))
      return
    }

    setSaving(true)
    try {
      await updatePortfolio({ portfolioId, name: trimmed })
      toast.success(t('toast.portfolioNameUpdated'))
    } catch (error) {
      Sentry.captureException(error)
      setPortfolioName(name)
      toast.error(t('toast.failedUpdatePortfolioName'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ItemCard>
      <ItemCardItems>
        <ItemCardItem>
          <ItemCardItemContent>
            <ItemCardItemTitle>
              {t('settings.portfolioGeneral.portfolioName')}
            </ItemCardItemTitle>
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
