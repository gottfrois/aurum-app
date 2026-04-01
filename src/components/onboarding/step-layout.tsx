import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'

interface StepLayoutProps {
  title: string
  subtitle: string
  children?: React.ReactNode
  onBack?: () => void
  onSubmit: () => void
  submitLabel: string
  submitDisabled?: boolean
  loading?: boolean
  onSkip?: () => void
  skipLabel?: string
  skipDisabled?: boolean
}

export function StepLayout({
  title,
  subtitle,
  children,
  onBack,
  onSubmit,
  submitLabel,
  submitDisabled,
  loading,
  onSkip,
  skipLabel,
  skipDisabled,
}: StepLayoutProps) {
  const { t } = useTranslation()
  const resolvedSkipLabel = skipLabel ?? t('common.skip')
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-balance text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {children}

      {onSkip && (
        <button
          type="button"
          className="self-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          onClick={onSkip}
          disabled={skipDisabled || loading}
        >
          {resolvedSkipLabel}
        </button>
      )}

      {onBack ? (
        <div className="flex justify-between gap-2">
          <Button
            variant="secondary"
            onClick={onBack}
            disabled={loading || skipDisabled}
          >
            <ChevronLeft className="size-4" />
            {t('common.back')}
          </Button>
          <Button
            disabled={submitDisabled}
            loading={loading}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={submitDisabled}
          loading={loading}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      )}
    </div>
  )
}
