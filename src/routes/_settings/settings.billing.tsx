import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { ExternalLink } from 'lucide-react'
import { CustomerPortalLink } from '@convex-dev/polar/react'
import { api } from '../../../convex/_generated/api'
import {
  ItemCard,
  ItemCardFooter,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItemTitle,
  ItemCardItems,
} from '~/components/item-card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'

export const Route = createFileRoute('/_settings/settings/billing')({
  component: BillingPage,
})

const TIER_LABELS: Record<string, string> = {
  solo: 'Solo',
  team: 'Team',
  family: 'Family',
}

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  solo: { monthly: 9, yearly: 89 },
  team: { monthly: 25, yearly: 239 },
  family: { monthly: 39, yearly: 379 },
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amountCents / 100)
}

interface Order {
  id: string
  createdAt: string
  totalAmount: number
  currency: string
  status: string
  productName: string
}

function BillingPage() {
  const subscription = useQuery(api.billing.getSubscriptionStatus)
  const listRecentOrders = useAction(api.billing.listRecentOrders)
  const [orders, setOrders] = useState<Array<Order> | undefined>(undefined)

  useEffect(() => {
    if (subscription?.isActive) {
      void listRecentOrders().then(setOrders)
    }
  }, [subscription?.isActive, listRecentOrders])

  if (subscription === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <header>
          <Skeleton className="h-9 w-32" />
        </header>
        <div className="mt-8 space-y-6">
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!subscription) return null

  const tierLabel = subscription.tier
    ? (TIER_LABELS[subscription.tier] ?? subscription.tier)
    : 'None'
  const prices = subscription.tier
    ? (PLAN_PRICES[subscription.tier] ?? null)
    : null
  const displayPrice = prices
    ? subscription.interval === 'yearly'
      ? prices.yearly
      : prices.monthly
    : null

  const trialDaysRemaining = subscription.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (subscription.trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Billing</h1>
        {subscription.isActive && (
          <CustomerPortalLink
            polarApi={{
              generateCustomerPortalUrl: api.polar.generateCustomerPortalUrl,
            }}
          >
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              Manage subscription
              <ExternalLink className="size-3.5" />
            </span>
          </CustomerPortalLink>
        )}
      </header>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your plan and billing
      </p>

      <div className="mt-8 space-y-6">
        {subscription.isActive ? (
          <div className="grid grid-cols-3 gap-6 rounded-lg border p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{tierLabel}</span>
                <Badge>Current</Badge>
                {subscription.isTrial && (
                  <Badge variant="secondary">Trial</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {displayPrice !== null && (
                  <>
                    {displayPrice}&#8364;
                    {subscription.interval === 'yearly'
                      ? '/yr — billed annually'
                      : '/mo'}
                  </>
                )}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium">Seats</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {subscription.currentSeats} of {subscription.seats}
                {subscription.pendingInvitations > 0 &&
                  ` (${subscription.pendingInvitations} pending)`}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium">Next renewal</p>
              {subscription.isTrial && trialDaysRemaining !== null ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {trialDaysRemaining === 0
                    ? 'Trial expires today'
                    : `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left in trial`}
                </p>
              ) : subscription.renewsAt ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(subscription.renewsAt)}
                  {displayPrice !== null && <> — {displayPrice}&#8364;</>}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border p-6">
            <p className="text-sm text-muted-foreground">
              Your subscription has expired.
            </p>
            <Button asChild size="sm">
              <Link to="/checkout">Resubscribe</Link>
            </Button>
          </div>
        )}

        {orders !== undefined && orders.length > 0 && (
          <ItemCard>
            <ItemCardItems>
              {orders.map((order) => (
                <ItemCardItem key={order.id}>
                  <ItemCardItemContent>
                    <ItemCardItemTitle>
                      {formatDate(new Date(order.createdAt).getTime())}
                    </ItemCardItemTitle>
                    <ItemCardItemDescription>
                      {order.productName}
                    </ItemCardItemDescription>
                  </ItemCardItemContent>
                  <ItemCardItemAction>
                    <span className="text-sm font-medium">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </span>
                  </ItemCardItemAction>
                </ItemCardItem>
              ))}
            </ItemCardItems>
            <ItemCardFooter>
              <CustomerPortalLink
                polarApi={{
                  generateCustomerPortalUrl:
                    api.polar.generateCustomerPortalUrl,
                }}
              >
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  More invoices
                  <ExternalLink className="size-3.5" />
                </span>
              </CustomerPortalLink>
            </ItemCardFooter>
          </ItemCard>
        )}
      </div>
    </div>
  )
}
