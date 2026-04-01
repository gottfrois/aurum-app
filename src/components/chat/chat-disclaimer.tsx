import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SystemMessage } from '~/components/ui/system-message'

export function ChatDisclaimer() {
  const { t } = useTranslation()
  return (
    <SystemMessage variant="warning" icon={<ShieldAlert className="size-4" />}>
      {t('chat.disclaimer')}
    </SystemMessage>
  )
}
