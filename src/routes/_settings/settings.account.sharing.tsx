import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Share2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  ItemCard,
  ItemCardHeader,
  ItemCardHeaderContent,
  ItemCardHeaderTitle,
  ItemCardItem,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { PortfolioAvatar } from '~/components/portfolio-avatar'
import { RequireFamilyPlan } from '~/components/require-family-plan'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import { Switch } from '~/components/ui/switch'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_settings/settings/account/sharing')({
  component: SharingPage,
})

function SharingPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Sharing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which portfolios to share with your family.
        </p>
      </header>
      <div className="mt-8 space-y-6">
        <RequireFamilyPlan fallback={<UpgradePrompt />}>
          <SharingSettings />
        </RequireFamilyPlan>
      </div>
    </div>
  )
}

function UpgradePrompt() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Share2 />
        </EmptyMedia>
        <EmptyTitle>Family Plan Required</EmptyTitle>
        <EmptyDescription>
          Portfolio sharing is available on the Family plan. Upgrade to share
          portfolios with your family members.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function SharingSettings() {
  const portfolios = useQuery(api.portfolios.listPortfolioSharing)
  const updateSharing = useMutation(api.portfolios.updatePortfolioSharing)

  if (portfolios === undefined) {
    return (
      <ItemCard>
        <ItemCardHeader>
          <ItemCardHeaderContent>
            <Skeleton className="h-5 w-40" />
          </ItemCardHeaderContent>
        </ItemCardHeader>
        <ItemCardItems>
          {[1, 2].map((i) => (
            <ItemCardItem key={i}>
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </ItemCardItem>
          ))}
        </ItemCardItems>
      </ItemCard>
    )
  }

  if (portfolios.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Share2 />
          </EmptyMedia>
          <EmptyTitle>No Portfolios</EmptyTitle>
          <EmptyDescription>
            Create a portfolio first to configure sharing settings.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  async function handleToggleShared(portfolioId: string, shared: boolean) {
    try {
      await updateSharing({ portfolioId: portfolioId as never, shared })
      toast.success(shared ? 'Portfolio shared' : 'Portfolio unshared')
    } catch {
      toast.error('Failed to update sharing')
    }
  }

  async function handleToggleAmounts(
    portfolioId: string,
    shareAmounts: boolean,
  ) {
    try {
      await updateSharing({ portfolioId: portfolioId as never, shareAmounts })
    } catch {
      toast.error('Failed to update sharing')
    }
  }

  return (
    <ItemCard>
      <ItemCardHeader>
        <ItemCardHeaderContent>
          <ItemCardHeaderTitle>Your Portfolios</ItemCardHeaderTitle>
        </ItemCardHeaderContent>
      </ItemCardHeader>
      <ItemCardItems>
        {portfolios.map((portfolio) => (
          <ItemCardItem key={portfolio._id}>
            <div className="flex items-center gap-3">
              <PortfolioAvatar name={portfolio.name} className="size-8" />
              <ItemCardItemContent>
                <ItemCardItemTitle>{portfolio.name}</ItemCardItemTitle>
                <ItemCardItemDescription>
                  {portfolio.shared ? 'Shared with family' : 'Not shared'}
                </ItemCardItemDescription>
              </ItemCardItemContent>
            </div>
            <div className="flex items-center gap-4">
              {portfolio.shared && (
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`amounts-${portfolio._id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Show amounts
                  </Label>
                  <Switch
                    id={`amounts-${portfolio._id}`}
                    checked={portfolio.shareAmounts}
                    onCheckedChange={(checked) =>
                      handleToggleAmounts(portfolio._id, checked)
                    }
                  />
                </div>
              )}
              <Switch
                checked={portfolio.shared}
                onCheckedChange={(checked) =>
                  handleToggleShared(portfolio._id, checked)
                }
              />
            </div>
          </ItemCardItem>
        ))}
      </ItemCardItems>
    </ItemCard>
  )
}
