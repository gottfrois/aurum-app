import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'
import { AppSidebar } from '~/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar'
import { EncryptionSetupDialog } from '~/components/encryption-setup-dialog'
import { TrialBanner } from '~/components/trial-banner'
import { ConnectionAlertBanner } from '~/components/connection-alert-banner'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  const subscription = useQuery(api.billing.getSubscriptionStatus)
  const navigate = useNavigate()

  useEffect(() => {
    // subscription is undefined while loading — do nothing
    // subscription is null if unauthenticated or no workspace — do nothing (other guards handle this)
    if (subscription === undefined || subscription === null) return

    // If no active subscription, redirect to checkout
    if (!subscription.isActive) {
      void navigate({ to: '/checkout' })
    }
  }, [subscription, navigate])

  // While loading subscription status, render the layout without blocking
  // to avoid a flash of blank screen
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        {subscription?.isTrial && subscription.trialEndsAt && (
          <TrialBanner trialEndsAt={subscription.trialEndsAt} />
        )}
        <ConnectionAlertBanner />
        <Outlet />
      </SidebarInset>
      <EncryptionSetupDialog />
    </SidebarProvider>
  )
}
