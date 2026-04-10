import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useTheme } from 'next-themes'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AppSidebar } from '~/components/app-sidebar'

const ChatPanel = React.lazy(() =>
  import('~/components/chat/chat-panel').then((m) => ({
    default: m.ChatPanel,
  })),
)

import { CommandPalette } from '~/components/command-palette'
import { ConnectionAlertBanner } from '~/components/connection-alert-banner'
import { ShortcutsDrawer } from '~/components/shortcuts-drawer'
import { SiteFooter } from '~/components/site-footer'
import { TrialBanner } from '~/components/trial-banner'
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '~/components/ui/sidebar'
import { useBilling } from '~/contexts/billing-context'
import {
  ChatProvider,
  useChatDispatch,
  useChatState,
} from '~/contexts/chat-context'
import { CommandProvider, useCommandDispatch } from '~/contexts/command-context'
import { useEncryption } from '~/contexts/encryption-context'
import { useMoneyPreferences } from '~/contexts/money-preferences-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useCommand } from '~/hooks/use-command'
import { useNavigationCommands } from '~/hooks/use-navigation-commands'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppCommands() {
  const { t } = useTranslation()
  const { setPaletteState } = useCommandDispatch()
  const { toggleSidebar } = useSidebar()
  const { lock, isUnlocked } = useEncryption()
  const { togglePrivacy } = useMoneyPreferences()
  const { setTheme } = useTheme()
  const { openNewChat } = useChatDispatch()
  const { singlePortfolioId } = usePortfolio()
  const generateConnectUrl = useAction(api.powens.generateConnectUrl)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)

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
    handler: async () => {
      if (!singlePortfolioId) return
      try {
        const url = await generateConnectUrl({
          portfolioId: singlePortfolioId,
        })
        window.location.href = url
      } catch (err) {
        console.error('Failed to generate connect URL:', err)
        toast.error(t('dialogs.addConnection.error'))
      }
    },
    disabled: !singlePortfolioId,
  })

  useCommand('vault.lock', {
    handler: () => {
      void lock()
    },
    disabled: !isUnlocked,
  })

  useCommand('privacy.toggle', {
    handler: togglePrivacy,
  })

  useCommand('theme.light', {
    handler: () => setTheme('light'),
  })

  useCommand('theme.dark', {
    handler: () => setTheme('dark'),
  })

  useCommand('theme.system', {
    handler: () => setTheme('system'),
  })

  useCommand('ai.chat', {
    handler: openNewChat,
  })

  useNavigationCommands()

  return (
    <ShortcutsDrawer open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
  )
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
          <AppCommands />
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
