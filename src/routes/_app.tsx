import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import * as React from 'react'

const ChatPanel = React.lazy(() =>
  import('~/components/chat/chat-panel').then((m) => ({
    default: m.ChatPanel,
  })),
)

import { AppSidebar } from '~/components/app-sidebar'
import { CommandPalette } from '~/components/command-palette'
import { CommonCommands } from '~/components/common-commands'
import { ConnectionAlertBanner } from '~/components/connection-alert-banner'
import { SiteFooter } from '~/components/site-footer'
import { TrialBanner } from '~/components/trial-banner'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar'
import { useBilling } from '~/contexts/billing-context'
import {
  ChatProvider,
  useChatDispatch,
  useChatState,
} from '~/contexts/chat-context'
import { CommandProvider } from '~/contexts/command-context'
import { useMoneyPreferences } from '~/contexts/money-preferences-context'
import { useCommand } from '~/hooks/use-command'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppOnlyCommands() {
  const navigate = useNavigate()
  const { togglePrivacy } = useMoneyPreferences()
  const { openNewChat } = useChatDispatch()

  useCommand('privacy.toggle', {
    handler: togglePrivacy,
  })

  useCommand('ai.chat', {
    handler: openNewChat,
  })

  useCommand('view.create', {
    handler: () =>
      void navigate({ to: '/cash-flow', search: { createView: true } }),
  })

  return null
}

function AppLayout() {
  const { subscription } = useBilling()

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
      <ChatProvider>
        <SidebarProvider>
          <CommonCommands />
          <AppOnlyCommands />
          <AppSidebar variant="inset" />
          <SidebarInset>
            {subscription?.isTrial && subscription.trialEndsAt && (
              <TrialBanner trialEndsAt={subscription.trialEndsAt} />
            )}
            <ConnectionAlertBanner />
            <AppMainContent />
            <SiteFooter />
          </SidebarInset>
          <CommandPalette />
        </SidebarProvider>
      </ChatProvider>
    </CommandProvider>
  )
}

function AppMainContent() {
  const { panelMode } = useChatState()

  return (
    <>
      {panelMode === 'expanded' ? (
        <React.Suspense>
          <ChatPanel />
        </React.Suspense>
      ) : (
        <Outlet />
      )}
      {panelMode === 'popover' && (
        <React.Suspense>
          <ChatPanel />
        </React.Suspense>
      )}
    </>
  )
}
