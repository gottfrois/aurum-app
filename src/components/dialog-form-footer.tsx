import { useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Button } from '~/components/ui/button'
import { DialogFooter } from '~/components/ui/dialog'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'

interface DialogFormFooterProps {
  onCancel: () => void
  onConfirm: () => void
  disabled: boolean
  saving: boolean
  confirmLabel: string
}

export function DialogFormFooter({
  onCancel,
  onConfirm,
  disabled,
  saving,
  confirmLabel,
}: DialogFormFooterProps) {
  const handleConfirm = useCallback(() => {
    if (!disabled) onConfirm()
  }, [disabled, onConfirm])

  useHotkeys('escape', onCancel, {
    enableOnFormTags: true,
    preventDefault: true,
  })

  useHotkeys('mod+enter', handleConfirm, {
    enabled: !disabled,
    enableOnFormTags: true,
    preventDefault: true,
  })

  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>
        Cancel <Kbd>Esc</Kbd>
      </Button>
      <Button onClick={handleConfirm} disabled={disabled} loading={saving}>
        {confirmLabel} <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
      </Button>
    </DialogFooter>
  )
}
