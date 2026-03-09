import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, X } from 'lucide-react'
import { useConnectionsNeedingAttention } from '~/hooks/use-connections-needing-attention'

export function ConnectionAlertBanner() {
  const { connections, count, isLoading } = useConnectionsNeedingAttention()
  const [dismissed, setDismissed] = useState(false)

  if (isLoading || count === 0 || dismissed) {
    return null
  }

  const message =
    count === 1
      ? `${connections[0].connectorName} needs re-authentication`
      : `${count} connections need attention`

  return (
    <div className="flex items-center justify-between gap-4 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 lg:px-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>{message}</span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/settings/connections"
          className="shrink-0 text-sm font-medium underline-offset-4 hover:underline"
        >
          Review connections
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-sm p-0.5 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
