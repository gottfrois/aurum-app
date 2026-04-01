import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import { Label } from '~/components/ui/label'

interface PassphraseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unlock: (passphrase: string) => Promise<void>
  onUnlocked: () => void
  description?: string
  submitLabel?: string
}

export function PassphraseDialog({
  open,
  onOpenChange,
  unlock,
  onUnlocked,
  description,
  submitLabel,
}: PassphraseDialogProps) {
  const { t } = useTranslation()
  const resolvedDescription =
    description ?? t('dialogs.passphrase.defaultDescription')
  const resolvedSubmitLabel = submitLabel ?? t('common.unlock')
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passphrase) return
    setError(null)
    setUnlocking(true)
    try {
      await unlock(passphrase)
      setPassphrase('')
      onUnlocked()
    } catch {
      setError(t('toast.invalidPassphrase'))
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('dialogs.passphrase.title')}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="passphrase-input">
                {t('dialogs.passphrase.label')}
              </Label>
              <Input
                id="passphrase-input"
                type="password"
                placeholder={t('dialogs.passphrase.placeholder')}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <PassphraseFooter
            onCancel={() => onOpenChange(false)}
            disabled={!passphrase}
            unlocking={unlocking}
            submitLabel={resolvedSubmitLabel}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PassphraseFooter({
  onCancel,
  disabled,
  unlocking,
  submitLabel,
}: {
  onCancel: () => void
  disabled: boolean
  unlocking: boolean
  submitLabel: string
}) {
  const { t } = useTranslation()
  useHotkeys('escape', onCancel, {
    enableOnFormTags: true,
    preventDefault: true,
  })

  return (
    <DialogFooter className="mt-4">
      <Button type="button" variant="outline" onClick={onCancel}>
        {t('common.cancel')} <Kbd>Esc</Kbd>
      </Button>
      <Button type="submit" disabled={disabled} loading={unlocking}>
        {submitLabel} <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
      </Button>
    </DialogFooter>
  )
}
