import { useMutation } from 'convex/react'
import * as React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { HotkeyDisplay, Kbd } from '~/components/ui/kbd'
import { Label } from '~/components/ui/label'
import { usePortfolio } from '~/contexts/portfolio-context'
import { api } from '../../convex/_generated/api'

export function CreatePortfolioDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const createPortfolio = useMutation(api.portfolios.createPortfolio)
  const { setActivePortfolioId } = usePortfolio()
  const [newName, setNewName] = React.useState('')

  async function handleCreate() {
    if (!newName.trim()) return
    const id = await createPortfolio({ name: newName.trim(), icon: 'User' })
    setActivePortfolioId(id)
    setNewName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('dialogs.createPortfolio.title')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="portfolio-name">
              {t('dialogs.createPortfolio.nameLabel')}
            </Label>
            <Input
              id="portfolio-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('dialogs.createPortfolio.namePlaceholder')}
            />
          </div>
        </div>
        <CreatePortfolioFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={handleCreate}
          disabled={!newName.trim()}
        />
      </DialogContent>
    </Dialog>
  )
}

function CreatePortfolioFooter({
  onCancel,
  onConfirm,
  disabled,
}: {
  onCancel: () => void
  onConfirm: () => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const handleConfirm = React.useCallback(() => {
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
        {t('common.cancel')} <Kbd>Esc</Kbd>
      </Button>
      <Button onClick={handleConfirm} disabled={disabled}>
        {t('common.create')} <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
      </Button>
    </DialogFooter>
  )
}
