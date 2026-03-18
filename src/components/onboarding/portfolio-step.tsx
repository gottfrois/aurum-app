import { useMutation } from 'convex/react'
import {
  Briefcase,
  Home,
  PiggyBank,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { api } from '../../../convex/_generated/api'
import { StepLayout } from './step-layout'
import type { OnboardingStepProps } from './types'

const PORTFOLIO_ICONS = [
  { name: 'User', icon: User },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Home', icon: Home },
  { name: 'Wallet', icon: Wallet },
  { name: 'PiggyBank', icon: PiggyBank },
  { name: 'TrendingUp', icon: TrendingUp },
]

export function PortfolioStep({
  goToStep,
  setSubmitting,
}: OnboardingStepProps) {
  const [name, setName] = useState('Personal')
  const [selectedIcon, setSelectedIcon] = useState('User')
  const [saving, setSaving] = useState(false)
  const createPortfolio = useMutation(api.portfolios.createPortfolio)
  const updateStep = useMutation(api.onboarding.updateOnboardingStep)

  async function handleNext() {
    setSaving(true)
    setSubmitting(true)
    try {
      await createPortfolio({ name, icon: selectedIcon })
      await updateStep({ step: 'connection' })
      goToStep('connection')
    } catch (err) {
      toast.error('Failed to create portfolio')
      console.error(err)
      setSaving(false)
      setSubmitting(false)
    }
  }

  return (
    <StepLayout
      title="Create your first portfolio"
      subtitle="Portfolios help you organize your financial accounts"
      onBack={() => goToStep('vault')}
      onSubmit={handleNext}
      submitLabel="Continue"
      submitDisabled={!name.trim()}
      loading={saving}
    >
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="portfolio-name">Portfolio name</Label>
          <Input
            id="portfolio-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Personal"
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label>Icon</Label>
          <div className="flex flex-wrap gap-2">
            {PORTFOLIO_ICONS.map(({ name: iconName, icon: Icon }) => (
              <button
                key={iconName}
                type="button"
                className={`flex size-10 items-center justify-center rounded-md border transition-colors ${
                  selectedIcon === iconName
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                }`}
                onClick={() => setSelectedIcon(iconName)}
              >
                <Icon className="size-5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </StepLayout>
  )
}
