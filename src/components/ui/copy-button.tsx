import { Check, Copy } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'

interface CopyButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'children'> {
  value: string
  /** Accessible label + tooltip when not yet copied. Defaults to `common.copy`. */
  label?: string
  /** Icon size in pixels — applied to the Copy/Check icon. */
  iconSize?: number
}

/**
 * Icon-only button that copies `value` to the clipboard and briefly shows a
 * check mark. Uses generic `common.copy` / `common.copied` translations.
 */
export function CopyButton({
  value,
  label,
  iconSize = 14,
  className,
  variant = 'ghost',
  size = 'icon',
  onClick,
  ...props
}: CopyButtonProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const triggerLabel = label ?? t('common.copy')
  const activeLabel = copied ? t('common.copied') : triggerLabel

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    void navigator.clipboard.writeText(value)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          aria-label={activeLabel}
          onClick={handleClick}
          className={cn('text-muted-foreground', className)}
          {...props}
        >
          {copied ? (
            <Check style={{ width: iconSize, height: iconSize }} />
          ) : (
            <Copy style={{ width: iconSize, height: iconSize }} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{activeLabel}</TooltipContent>
    </Tooltip>
  )
}
