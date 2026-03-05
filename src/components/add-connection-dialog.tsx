import * as React from 'react'
import { Loader2, Landmark } from 'lucide-react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useProfile } from '~/contexts/profile-context'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  const { activeProfileId } = useProfile()
  const generateConnectUrl = useAction(api.powens.generateConnectUrl)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleConnect() {
    if (!activeProfileId) return
    setLoading(true)
    setError(null)

    try {
      const url = await generateConnectUrl({ profileId: activeProfileId })
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect a Bank</DialogTitle>
          <DialogDescription>
            Securely connect your bank account to start tracking your finances.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Landmark className="size-8 text-muted-foreground" />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button
            size="lg"
            onClick={handleConnect}
            disabled={loading || !activeProfileId}
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {loading ? 'Connecting...' : 'Connect Bank Account'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
