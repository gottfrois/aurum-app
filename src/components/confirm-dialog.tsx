import { Check, Copy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import { Label } from '~/components/ui/label'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** The text the user must type to confirm. When omitted, no confirmation input is shown. */
  confirmValue?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmValue,
  confirmLabel,
  cancelLabel,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm')
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel')
  const [inputValue, setInputValue] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const needsConfirmation = confirmValue !== undefined
  const isConfirmed = !needsConfirmation || inputValue === confirmValue

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }
  }, [])

  useEffect(() => clearCopyTimer, [clearCopyTimer])

  function handleCopy() {
    if (!confirmValue) return
    navigator.clipboard.writeText(confirmValue)
    setCopied(true)
    clearCopyTimer()
    copyTimerRef.current = setTimeout(() => {
      setCopied(false)
      copyTimerRef.current = null
    }, 1500)
  }

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setInputValue('')
        setCopied(false)
        clearCopyTimer()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, clearCopyTimer],
  )

  const handleCancel = useCallback(() => {
    handleOpenChange(false)
  }, [handleOpenChange])

  const handleConfirm = useCallback(() => {
    if (!loading && isConfirmed) {
      onConfirm()
    }
  }, [loading, isConfirmed, onConfirm])

  useHotkeys('escape', handleCancel, {
    enabled: open,
    enableOnFormTags: true,
    preventDefault: true,
  })

  useHotkeys('mod+enter', handleConfirm, {
    enabled: open && isConfirmed,
    enableOnFormTags: true,
    preventDefault: true,
  })

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {needsConfirmation && (
          <div className="grid gap-2 py-2">
            <Label className="flex flex-wrap items-center gap-1">
              {t('dialogs.confirm.typeLabel')}
              <Badge asChild variant="secondary" className="font-mono">
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label={t('dialogs.confirm.copyToClipboard', {
                    value: confirmValue,
                  })}
                  className="cursor-pointer"
                >
                  {confirmValue}
                  {copied ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </Badge>
              {t('dialogs.confirm.toConfirm')}
            </Label>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmValue}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {resolvedCancelLabel} <Kbd>Esc</Kbd>
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={loading || !isConfirmed}
            loading={loading}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {resolvedConfirmLabel}{' '}
            <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
