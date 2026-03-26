import { Check, Copy } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
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
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('')
  const [copied, setCopied] = useState(false)

  const needsConfirmation = confirmValue !== undefined
  const isConfirmed = !needsConfirmation || inputValue === confirmValue

  function handleCopy() {
    if (!confirmValue) return
    navigator.clipboard.writeText(confirmValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setInputValue('')
        setCopied(false)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange],
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
              Type
              <Badge
                variant="secondary"
                className="cursor-pointer gap-1 font-mono"
                onClick={handleCopy}
              >
                {confirmValue}
                {copied ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Badge>
              to confirm
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
            {cancelLabel} <Kbd>Esc</Kbd>
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
            {confirmLabel} <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
