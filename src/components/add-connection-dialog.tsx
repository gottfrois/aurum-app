import { useAction } from 'convex/react'
import { Landmark } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { usePortfolio } from '~/contexts/portfolio-context'
import { api } from '../../convex/_generated/api'

interface AddConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddConnectionDialog({
  open,
  onOpenChange,
}: AddConnectionDialogProps) {
  const { t } = useTranslation()
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
      setError(t('dialogs.addConnection.error'))
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogs.addConnection.title')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.addConnection.description')}
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
            disabled={!singlePortfolioId}
            loading={loading}
          >
            {t('button.addConnection')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
