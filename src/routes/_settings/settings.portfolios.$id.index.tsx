import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  ChevronRight,
  Link2,
  type LucideIcon,
  Settings,
  Sticker,
  Tag,
} from 'lucide-react'
import * as React from 'react'
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
              title="General"
              subtitle="Name and broader settings"
            />
            <NavItem
              to="/settings/portfolios/$id/connections"
              params={{ id: portfolio._id }}
              icon={Link2}
              title="Connections"
              subtitle="Manage portfolio connections"
            />
            <NavItem
              to="/settings/portfolios/$id/categories"
              params={{ id: portfolio._id }}
              icon={Tag}
              title="Categories"
              subtitle="Categories available to this portfolio"
            />
            <NavItem
              to="/settings/portfolios/$id/labels"
              params={{ id: portfolio._id }}
              icon={Sticker}
              title="Labels"
              subtitle="Labels available to this portfolio"
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
  const deletePortfolio = useMutation(api.portfolios.deletePortfolio)
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await deletePortfolio({ portfolioId })
      toast.success('Portfolio deleted')
      navigate({ to: '/settings/account' })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete portfolio',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Danger zone</h2>
      <ItemCard>
        <ItemCardItems>
          <ItemCardItem>
            <ItemCardItemContent>
              <ItemCardItemTitle>Delete portfolio</ItemCardItemTitle>
              <ItemCardItemDescription>
                Permanently delete this portfolio and all associated data. This
                action cannot be undone.
              </ItemCardItemDescription>
            </ItemCardItemContent>
            <ItemCardItemAction>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                Delete
              </Button>
            </ItemCardItemAction>
          </ItemCardItem>
        </ItemCardItems>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete portfolio"
          description={`This will permanently delete "${portfolioName}" and all associated data including connections, bank accounts, transactions, and investments. This action cannot be undone.`}
          confirmValue={portfolioName}
          confirmLabel="Delete"
          loading={loading}
          onConfirm={handleDelete}
        />
      </ItemCard>
    </section>
  )
}
