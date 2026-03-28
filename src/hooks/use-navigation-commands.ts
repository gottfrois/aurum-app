import { useNavigate } from '@tanstack/react-router'
import { useCommand } from '~/hooks/use-command'

export function useNavigationCommands(): void {
  const navigate = useNavigate()

  useCommand('nav.dashboard', {
    handler: () => void navigate({ to: '/' }),
  })
  useCommand('nav.transactions', {
    handler: () => void navigate({ to: '/transactions' }),
  })
  useCommand('nav.accounts', {
    handler: () => void navigate({ to: '/accounts' }),
  })
  useCommand('nav.settings', {
    handler: () => void navigate({ to: '/settings' }),
  })
  useCommand('nav.views', {
    handler: () => void navigate({ to: '/views' }),
  })
  useCommand('view.create', {
    handler: () =>
      void navigate({ to: '/transactions', search: { createView: true } }),
  })
}
