import { useAction } from 'convex/react'
import { useTheme } from 'next-themes'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ShortcutsDrawer } from '~/components/shortcuts-drawer'
import { useSidebar } from '~/components/ui/sidebar'
import { useCommandDispatch } from '~/contexts/command-context'
import { useEncryption } from '~/contexts/encryption-context'
import { usePortfolio } from '~/contexts/portfolio-context'
import { useCommand } from '~/hooks/use-command'
import { useNavigationCommands } from '~/hooks/use-navigation-commands'
import { api } from '../../convex/_generated/api'

export function CommonCommands() {
  const { t } = useTranslation()
  const { setPaletteState } = useCommandDispatch()
  const { toggleSidebar } = useSidebar()
  const { lock, isUnlocked } = useEncryption()
  const { setTheme } = useTheme()
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

  useCommand('theme.light', {
    handler: () => setTheme('light'),
  })

  useCommand('theme.dark', {
    handler: () => setTheme('dark'),
  })

  useCommand('theme.system', {
    handler: () => setTheme('system'),
  })

  useNavigationCommands()

  return (
    <ShortcutsDrawer open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
  )
}
