import { createFileRoute, Link } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  ItemCard,
  ItemCardFooter,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { RequireOwner } from '~/components/require-owner'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import { api } from '../../../convex/_generated/api'
import { PLANS } from '../../../convex/stripe'

export const Route = createFileRoute('/_settings/settings/workspace/billing')({
  component: BillingPage,
})

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

interface Invoice {
  id: string
  createdAt: string
  totalAmount: number
  currency: string
  status: string
}

function BillingPage() {
  const subscription = useQuery(api.billing.getSubscriptionStatus)
  const createPortalSession = useAction(api.billing.createPortalSession)
  const listRecentInvoices = useAction(api.billing.listRecentInvoices)
  const [invoices, setInvoices] = useState<Array<Invoice> | undefined>(
    undefined,
  )
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (subscription?.isActive) {
      void listRecentInvoices().then(setInvoices)
    }
  }, [subscription?.isActive, listRecentInvoices])

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const result = await createPortalSession()
      if (result.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error('Portal error:', error)
    } finally {
      setPortalLoading(false)
    }
  }

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

  const planConfig = subscription.plan ? PLANS[subscription.plan] : null

  return (
    <RequireOwner>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
        <PageHeader
          title="Billing"
          description="Manage your plan and billing"
          action={
            subscription.isActive && (
              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {portalLoading ? 'Loading...' : 'Manage subscription'}
                <ExternalLink className="size-3.5" />
              </button>
            )
          }
        />

        <div className="mt-8 space-y-6">
          {subscription.isActive ? (
            <div className="grid grid-cols-3 gap-6 rounded-lg border p-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Bunkr {planConfig?.name ?? ''}
                  </span>
                  <Badge>Current</Badge>
                  {subscription.isTrial && (
                    <Badge variant="secondary">Trial</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {planConfig
                    ? `${(subscription.interval === 'yearly' ? planConfig.yearly : planConfig.monthly) / 100}\u20AC`
                    : ''}
                  {subscription.interval === 'yearly'
                    ? '/yr \u2014 billed annually'
                    : '/mo'}
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
                {subscription.isTrial && subscription.trialEndsAt ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {(() => {
                      const days = Math.max(
                        0,
                        Math.ceil(
                          (subscription.trialEndsAt - Date.now()) /
                            (1000 * 60 * 60 * 24),
                        ),
                      )
                      return days === 0
                        ? 'Trial expires today'
                        : `${days} day${days !== 1 ? 's' : ''} left in trial`
                    })()}
                  </p>
                ) : subscription.renewsAt ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(subscription.renewsAt)}
                    {subscription.amount !== null && (
                      <>
                        {' \u2014 '}
                        {formatCurrency(
                          subscription.amount,
                          subscription.currency ?? 'eur',
                        )}
                      </>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">&mdash;</p>
                )}
              </div>

              {subscription.cancelAtPeriodEnd && (
                <div className="col-span-3 border-t pt-4 text-sm text-muted-foreground">
                  Subscription will cancel at the end of the current period.
                </div>
              )}
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

          {invoices !== undefined && invoices.length > 0 && (
            <ItemCard>
              <ItemCardItems>
                {invoices.map((invoice) => (
                  <ItemCardItem key={invoice.id}>
                    <ItemCardItemContent>
                      <ItemCardItemTitle>
                        {formatDate(new Date(invoice.createdAt).getTime())}
                      </ItemCardItemTitle>
                      <ItemCardItemDescription>
                        Bunkr {planConfig?.name ?? ''} subscription
                      </ItemCardItemDescription>
                    </ItemCardItemContent>
                    <ItemCardItemAction>
                      <span className="text-sm font-medium">
                        {formatCurrency(invoice.totalAmount, invoice.currency)}
                      </span>
                    </ItemCardItemAction>
                  </ItemCardItem>
                ))}
              </ItemCardItems>
              <ItemCardFooter>
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  More invoices
                  <ExternalLink className="size-3.5" />
                </button>
              </ItemCardFooter>
            </ItemCard>
          )}
        </div>
      </div>
    </RequireOwner>
  )
}
