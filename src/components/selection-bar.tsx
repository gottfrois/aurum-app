import { Command, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { useCommandRegistry } from '~/contexts/command-context'

interface SelectionBarProps {
  count: number
  totalMatchingCount: number
  selectAllMatching: boolean
  onSelectAllMatching: () => void
  onClear: () => void
}

export function SelectionBar({
  count,
  totalMatchingCount,
  selectAllMatching,
  onSelectAllMatching,
  onClear,
}: SelectionBarProps) {
  const { t } = useTranslation()
  const { openPalette } = useCommandRegistry()

  if (count === 0) return null

  const canSelectAll = !selectAllMatching && totalMatchingCount > count

  return (
    <div className="fixed bottom-8 left-[calc(50%-var(--removed-body-scroll-bar-size,0px)/2)] z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 rounded-full border bg-background px-2 py-2 shadow-xl">
        <Button variant="outline" className="pointer-events-none rounded-full">
          {t('selectionBar.countSelected', { count })}
        </Button>

        {canSelectAll && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={onSelectAllMatching}
          >
            {t('selectionBar.selectAll', { total: totalMatchingCount })}
          </Button>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={onClear}
          className="rounded-full"
        >
          <X />
        </Button>

        <div className="h-7 w-px shrink-0 bg-border" />

        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => openPalette()}
        >
          <Command />
          {t('common.actions')}
        </Button>
      </div>
    </div>
  )
}
