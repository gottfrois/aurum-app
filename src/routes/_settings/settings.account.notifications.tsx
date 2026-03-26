import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import {
  ItemCard,
  ItemCardItem,
  ItemCardItemAction,
  ItemCardItemContent,
  ItemCardItemDescription,
  ItemCardItems,
  ItemCardItemTitle,
} from '~/components/item-card'
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'
import { Switch } from '~/components/ui/switch'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute(
  '/_settings/settings/account/notifications',
)({
  component: NotificationsPage,
})

function NotificationsPage() {
  const consents = useQuery(api.onboarding.getConsents)
  const updateMarketing = useMutation(api.onboarding.updateMarketingConsent)

  if (consents === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-10 py-16">
        <header>
          <Skeleton className="h-9 w-48" />
        </header>
        <div className="mt-8 space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  async function handleToggleMarketing(checked: boolean) {
    try {
      await updateMarketing({ marketingCommunications: checked })
    } catch {
      toast.error('Failed to update notification preferences')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-10 py-16">
      <PageHeader
        title="Notifications"
        description="Choose what updates you want to receive."
      />
      <div className="mt-8 space-y-6">
        <div>
          <h2 className="text-lg font-medium">Updates from Bunkr</h2>
          <p className="text-sm text-muted-foreground">
            Subscribe to product announcements and important changes from the
            Bunkr team
          </p>
        </div>

        <ItemCard>
          <ItemCardItems>
            <ItemCardItem>
              <ItemCardItemContent>
                <ItemCardItemTitle>Marketing and onboarding</ItemCardItemTitle>
                <ItemCardItemDescription>
                  Occasional emails to help you get the most out of Bunkr
                </ItemCardItemDescription>
              </ItemCardItemContent>
              <ItemCardItemAction>
                <Switch
                  checked={consents?.marketingCommunications ?? false}
                  onCheckedChange={handleToggleMarketing}
                />
              </ItemCardItemAction>
            </ItemCardItem>
          </ItemCardItems>
        </ItemCard>
      </div>
    </div>
  )
}
