import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useAccount } from '~/contexts/account-context'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

export const Route = createFileRoute('/powens/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    connection_id: (search.connection_id as string) ?? '',
    state: (search.state as string) ?? '',
  }),
  component: PowensCallback,
})

function PowensCallback() {
  const { connection_id } = Route.useSearch()
  const navigate = useNavigate()
  const { activeAccountId } = useAccount()
  const handleCallback = useAction(api.powens.handleConnectionCallback)
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [error, setError] = React.useState<string | null>(null)
  const processed = React.useRef(false)

  React.useEffect(() => {
    if (processed.current || !connection_id || !activeAccountId) return
    processed.current = true

    handleCallback({
      connectionId: Number(connection_id),
      accountId: activeAccountId,
    })
      .then(() => {
        setStatus('success')
        setTimeout(() => navigate({ to: '/' }), 2000)
      })
      .catch((err) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Unknown error')
      })
  }, [connection_id, activeAccountId, handleCallback, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="size-12 animate-spin text-primary" />
            <h2 className="text-lg font-semibold">
              Connecting your bank account...
            </h2>
            <p className="text-sm text-muted-foreground">
              Please wait while we sync your data.
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="size-12 text-green-500" />
            <h2 className="text-lg font-semibold">
              Bank connected successfully!
            </h2>
            <p className="text-sm text-muted-foreground">
              Redirecting to dashboard...
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="size-12 text-destructive" />
            <h2 className="text-lg font-semibold">Connection failed</h2>
            <p className="text-sm text-destructive">{error}</p>
            <button
              className="mt-2 text-sm text-primary underline"
              onClick={() => navigate({ to: '/' })}
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
