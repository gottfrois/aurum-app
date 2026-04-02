import { ChevronLeft } from 'lucide-react'
import { useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'

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

  const handleSubmit = useCallback(() => {
    if (!submitDisabled && !loading) onSubmit()
  }, [submitDisabled, loading, onSubmit])

  const handleBack = useCallback(() => {
    if (onBack && !loading && !skipDisabled) onBack()
  }, [onBack, loading, skipDisabled])

  useHotkeys('mod+enter', handleSubmit, {
    enabled: !submitDisabled && !loading,
    enableOnFormTags: true,
    preventDefault: true,
  })

  useHotkeys('escape', handleBack, {
    enabled: !!onBack && !loading && !skipDisabled,
    enableOnFormTags: true,
    preventDefault: true,
  })

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
            {t('common.back')} <Kbd>Esc</Kbd>
          </Button>
          <Button
            disabled={submitDisabled}
            loading={loading}
            onClick={onSubmit}
          >
            {submitLabel} <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={submitDisabled}
          loading={loading}
          onClick={onSubmit}
        >
          {submitLabel} <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
        </Button>
      )}
    </div>
  )
}
