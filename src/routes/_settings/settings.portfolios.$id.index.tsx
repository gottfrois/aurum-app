import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  ChevronRight,
  Link2,
  type LucideIcon,
  Settings,
  Sticker,
  Tag,
  Workflow,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '~/components/confirm-dialog'
import {
  ItemCard,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { PortfolioAvatar } from '~/components/portfolio-avatar'
import { Button } from '~/components/ui/button'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_settings/settings/portfolios/$id/')({
  component: PortfolioSettingsPage,
})

function PortfolioSettingsPage() {
  const { t } = useTranslation()
  const { id } = Route.useParams()
  const portfolio = useQuery(api.portfolios.getPortfolio, {
    portfolioId: id as Id<'portfolios'>,
  })

  if (portfolio === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <Skeleton className="h-9 w-48" />
        <div className="mt-8 space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!portfolio) return null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <PageHeader
        title={portfolio.name}
        icon={<PortfolioAvatar name={portfolio.name} className="size-9" />}
      />
      <div className="mt-8 space-y-6">
        <ItemCard>
          <ItemCardItems>
            <NavItem
              to="/settings/portfolios/$id/general"
              params={{ id: portfolio._id }}
              icon={Settings}
              title={t('settings.portfolioOverview.general')}
              subtitle={t('settings.portfolioOverview.generalDescription')}
            />
            <NavItem
              to="/settings/portfolios/$id/connections"
              params={{ id: portfolio._id }}
              icon={Link2}
              title={t('settings.portfolioOverview.connections')}
              subtitle={t('settings.portfolioOverview.connectionsDescription')}
            />
            <NavItem
              to="/settings/portfolios/$id/categories"
              params={{ id: portfolio._id }}
              icon={Tag}
              title={t('settings.portfolioOverview.categories')}
              subtitle={t('settings.portfolioOverview.categoriesDescription')}
            />
            <NavItem
              to="/settings/portfolios/$id/labels"
              params={{ id: portfolio._id }}
              icon={Sticker}
              title={t('settings.portfolioOverview.labels')}
              subtitle={t('settings.portfolioOverview.labelsDescription')}
            />
            <NavItem
              to="/settings/portfolios/$id/rules"
              params={{ id: portfolio._id }}
              icon={Workflow}
              title={t('settings.portfolioOverview.rules')}
              subtitle={t('settings.portfolioOverview.rulesDescription')}
            />
          </ItemCardItems>
        </ItemCard>
        <DeletePortfolioCard
          portfolioId={portfolio._id}
          portfolioName={portfolio.name}
        />
      </div>
    </div>
  )
}

function NavItem({
  to,
  params,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string
  params: Record<string, string>
  icon: LucideIcon
  title: string
  subtitle: string
}) {
  return (
    <ItemCardItem>
      <Link
        to={to}
        params={params}
        className="flex w-full items-center gap-4 no-underline"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <ItemCardItemContent className="flex-1">
          <ItemCardItemTitle>{title}</ItemCardItemTitle>
          <ItemCardItemDescription>{subtitle}</ItemCardItemDescription>
        </ItemCardItemContent>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </ItemCardItem>
  )
}

function DeletePortfolioCard({
  portfolioId,
  portfolioName,
}: {
  portfolioId: Id<'portfolios'>
  portfolioName: string
}) {
  const { t } = useTranslation()
  const deletePortfolio = useMutation(api.portfolios.deletePortfolio)
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await deletePortfolio({ portfolioId })
      toast.success(t('toast.portfolioDeleted'))
      navigate({ to: '/settings/account' })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('toast.failedDeletePortfolio'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">
        {t('settings.portfolioOverview.dangerZone')}
      </h2>
      <ItemCard>
        <ItemCardItems>
          <ItemCardItem>
            <ItemCardItemContent>
              <ItemCardItemTitle>
                {t('settings.portfolioOverview.deletePortfolio')}
              </ItemCardItemTitle>
              <ItemCardItemDescription>
                {t('settings.portfolioOverview.deletePortfolioDescription')}
              </ItemCardItemDescription>
            </ItemCardItemContent>
            <ItemCardItemAction>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                {t('common.delete')}
              </Button>
            </ItemCardItemAction>
          </ItemCardItem>
        </ItemCardItems>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t('settings.portfolioOverview.deletePortfolio')}
          description={t('settings.portfolioOverview.deletePortfolioConfirm', {
            name: portfolioName,
          })}
          confirmValue={portfolioName}
          confirmLabel={t('common.delete')}
          loading={loading}
          onConfirm={handleDelete}
        />
      </ItemCard>
    </section>
  )
}
