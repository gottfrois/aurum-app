import { Clock, Lock } from 'lucide-react'
import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { HotkeyDisplay } from '~/components/ui/kbd'
import { useEncryption } from '~/contexts/encryption-context'

export function PassphrasePrompt() {
  const { t } = useTranslation()
  const {
    isEncryptionEnabled,
    isUnlocked,
    isLoading,
    unlock,
    hasPersonalKey,
    hasWorkspaceAccess,
  } = useEncryption()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  useHotkeys(
    'mod+enter',
    () => {
      const form = document.querySelector('form')
      form?.requestSubmit()
    },
    {
      enabled:
        !unlocking &&
        passphrase.trim().length > 0 &&
        hasPersonalKey &&
        hasWorkspaceAccess &&
        !isUnlocked,
      enableOnFormTags: true,
      preventDefault: true,
    },
  )

  if (isLoading || !isEncryptionEnabled || isUnlocked) return null

  // Member has personal key but no workspace key slot — waiting for access
  if (hasPersonalKey && !hasWorkspaceAccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Clock className="size-6 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">
              {t('dialogs.passphrasePrompt.waitingTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('dialogs.passphrasePrompt.waitingDescription')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Member hasn't set up personal key yet — handled in settings page, not here
  if (!hasPersonalKey) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passphrase.trim()) return
    setError(null)
    setUnlocking(true)
    try {
      await unlock(passphrase)
      setPassphrase('')
    } catch {
      setError(t('toast.incorrectPassphrase'))
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">
            {t('dialogs.passphrasePrompt.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('dialogs.passphrasePrompt.description')}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder={t('dialogs.passphrasePrompt.placeholder')}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
              data-1p-type="password"
              autoComplete="passphrase"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button type="submit" className="w-full" loading={unlocking}>
            <span className="flex items-center justify-between gap-2">
              <span>{t('common.unlock')}</span>
              <HotkeyDisplay hotkey={{ keys: 'mod+enter' }} />
            </span>
          </Button>
        </form>
      </div>
    </div>
  )
}
