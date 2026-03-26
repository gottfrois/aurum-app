import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import * as React from 'react'
import { AddConnectionDialog } from '~/components/add-connection-dialog'
import { AppSidebar } from '~/components/app-sidebar'
import { CommandPalette } from '~/components/command-palette'
import { ConnectionAlertBanner } from '~/components/connection-alert-banner'
import { ShortcutsDrawer } from '~/components/shortcuts-drawer'
import { TrialBanner } from '~/components/trial-banner'
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '~/components/ui/sidebar'
import { CommandProvider, useCommandDispatch } from '~/contexts/command-context'
import { useCommand } from '~/hooks/use-command'
import { useNavigationCommands } from '~/hooks/use-navigation-commands'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppCommands() {
  const { setPaletteState } = useCommandDispatch()
  const { toggleSidebar } = useSidebar()
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
  const [connectionDialogOpen, setConnectionDialogOpen] = React.useState(false)

  useCommand('palette.toggle', {
    handler: () => setPaletteState((prev) => ({ open: !prev.open })),
  })

  useCommand('sidebar.toggle', {
    handler: toggleSidebar,
  })

  useCommand('shortcuts.show', {
    handler: () => setShortcutsOpen((prev) => !prev),
  })

  useCommand('connection.add', {
    handler: () => setConnectionDialogOpen(true),
  })

  useNavigationCommands()

  return (
    <>
      <ShortcutsDrawer open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <AddConnectionDialog
        open={connectionDialogOpen}
        onOpenChange={setConnectionDialogOpen}
      />
    </>
  )
}

function AppLayout() {
  const subscription = useQuery(api.billing.getSubscriptionStatus)

  React.useEffect(() => {
    // subscription is undefined while loading — do nothing
    // subscription is null if unauthenticated or no workspace — do nothing (other guards handle this)
    if (subscription === undefined || subscription === null) return

    // TODO: Re-enable once Stripe account is set up
    // if (!subscription.isActive) {
    //   void navigate({ to: '/checkout' })
    // }
  }, [subscription])

  return (
    <CommandProvider>
      <SidebarProvider>
        <AppCommands />
        <AppSidebar variant="inset" />
        <SidebarInset>
          {subscription?.isTrial && subscription.trialEndsAt && (
            <TrialBanner trialEndsAt={subscription.trialEndsAt} />
          )}
          <ConnectionAlertBanner />
          <Outlet />
        </SidebarInset>
        <CommandPalette />
      </SidebarProvider>
    </CommandProvider>
  )
}
