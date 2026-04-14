import { BotMessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty'

const SUGGESTION_KEYS = [
  'chat.suggestion.topSpending',
  'chat.suggestion.netWorthTrend',
  'chat.suggestion.biggestExpenses',
  'chat.suggestion.recentChanges',
] as const

interface ChatEmptyStateProps {
  onSuggestionClick: (suggestion: string) => void
}

export function ChatEmptyState({ onSuggestionClick }: ChatEmptyStateProps) {
  const { t } = useTranslation()

  return (
    <Empty className="border-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BotMessageSquare />
        </EmptyMedia>
        <EmptyTitle>{t('chat.emptyTitle')}</EmptyTitle>
        <EmptyDescription>{t('chat.emptyDescription')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTION_KEYS.map((key) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              onClick={() => onSuggestionClick(t(key))}
            >
              {t(key)}
            </Button>
          ))}
        </div>
      </EmptyContent>
    </Empty>
  )
}
