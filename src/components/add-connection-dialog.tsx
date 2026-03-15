import * as React from 'react'
import { Landmark, Loader2 } from 'lucide-react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { usePortfolio } from '~/contexts/portfolio-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'

interface AddConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddConnectionDialog({
  open,
  onOpenChange,
}: AddConnectionDialogProps) {
  const { singlePortfolioId } = usePortfolio()
  const generateConnectUrl = useAction(api.powens.generateConnectUrl)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleConnect() {
    if (!singlePortfolioId) return
    setLoading(true)
    setError(null)

    try {
      const url = await generateConnectUrl({ portfolioId: singlePortfolioId })
      window.location.href = url
    } catch (err) {
      console.error('Failed to generate connect URL:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a Connection</DialogTitle>
          <DialogDescription>
            Securely connect your bank, broker, or insurance to start tracking
            your finances.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Landmark className="size-8 text-muted-foreground" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            size="lg"
            onClick={handleConnect}
            disabled={loading || !singlePortfolioId}
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {loading ? 'Connecting...' : 'Add Connection'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
