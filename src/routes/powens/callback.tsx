import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import * as React from 'react'
import { usePortfolio } from '~/contexts/portfolio-context'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/powens/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    connection_id: (search.connection_id as string | undefined) ?? '',
    state: (search.state as string | undefined) ?? '',
    error: (search.error as string | undefined) ?? '',
  }),
  component: PowensCallback,
})

function PowensCallback() {
  const { connection_id, error: callbackError } = Route.useSearch()
  const navigate = useNavigate()
  const { singlePortfolioId } = usePortfolio()
  const { isAuthenticated } = useConvexAuth()
  const handleCallback = useAction(api.powens.handleConnectionCallback)
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding)
  const onboardingState = useQuery(
    api.onboarding.getOnboardingState,
    isAuthenticated ? {} : 'skip',
  )
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [error, setError] = React.useState<string | null>(null)
  const processed = React.useRef(false)

  React.useEffect(() => {
    if (processed.current) return

    if (callbackError) {
      processed.current = true
      setStatus('error')
      setError(
        callbackError === 'access_denied'
          ? 'Access was denied. Please try connecting your bank again.'
          : `Connection failed: ${callbackError}`,
      )
      return
    }

    if (!connection_id || !singlePortfolioId) return
    if (onboardingState === undefined) return // wait for onboarding state
    processed.current = true

    handleCallback({
      connectionId: Number(connection_id),
      portfolioId: singlePortfolioId,
    })
      .then(async () => {
        // Complete onboarding if user is mid-onboarding
        if (
          onboardingState.status === 'in_progress' ||
          onboardingState.status === 'none'
        ) {
          try {
            await completeOnboarding()
          } catch {
            // ignore — may already be complete
          }
        }
        setStatus('success')
        setTimeout(() => navigate({ to: '/' }), 2000)
      })
      .catch((err) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Unknown error')
      })
  }, [
    callbackError,
    connection_id,
    singlePortfolioId,
    handleCallback,
    navigate,
    onboardingState,
    completeOnboarding,
  ])

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
            <CheckCircle2 className="size-12 text-success" />
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
              type="button"
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
