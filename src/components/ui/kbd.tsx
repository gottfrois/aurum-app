import { formatHotkey, type Hotkey } from '~/lib/hotkeys'
import { cn } from '~/lib/utils'

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none',
        "[&_svg:not([class*='size-'])]:size-3",
        '[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10',
        '[[data-variant=default]_&]:bg-primary-foreground/20 [[data-variant=default]_&]:text-primary-foreground',
        '[[data-variant=destructive]_&]:bg-white/20 [[data-variant=destructive]_&]:text-white',
        className,
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  )
}

function HotkeyDisplay({
  hotkey,
  className,
}: {
  hotkey: Hotkey
  className?: string
}) {
  const formatted = formatHotkey(hotkey)

  return (
    <KbdGroup className={className}>
      {formatted.keys.map((combination, i) => (
        <span
          key={combination.join('+')}
          className="inline-flex items-center gap-0.5"
        >
          {i > 0 && (
            <span className="mx-0.5 text-xs text-muted-foreground">then</span>
          )}
          {combination.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </span>
      ))}
    </KbdGroup>
  )
}

export { HotkeyDisplay, Kbd, KbdGroup }
