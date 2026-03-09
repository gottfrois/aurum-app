import { Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'

interface TrialBannerProps {
  trialEndsAt: number
}

export function TrialBanner({ trialEndsAt }: TrialBannerProps) {
  const now = Date.now()
  const msRemaining = trialEndsAt - now
  const daysRemaining = Math.max(
    0,
    Math.ceil(msRemaining / (1000 * 60 * 60 * 24)),
  )

  return (
    <div className="flex items-center justify-between gap-4 border-b bg-muted/50 px-4 py-2 text-sm lg:px-6">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" />
        <span>
          {daysRemaining === 0
            ? 'Your trial expires today.'
            : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left in your trial.`}
        </span>
      </div>
      <Link
        to="/settings/billing"
        className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Upgrade now
      </Link>
    </div>
  )
}
