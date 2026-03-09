import { cn } from '~/lib/utils'

export function ItemCard({
  className,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-xs',
        className,
      )}
      {...props}
    />
  )
}

export function ItemCardHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative flex min-h-15 items-center justify-between gap-4 px-4 py-3',
        "after:absolute after:right-0 after:bottom-0 after:left-0 after:block after:h-px after:bg-border after:content-['']",
        'has-[+ul:empty]:after:hidden',
        className,
      )}
      {...props}
    />
  )
}

export function ItemCardHeaderContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex min-w-0 grow flex-col gap-0.5', className)}
      {...props}
    />
  )
}

export function ItemCardHeaderTitle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-2 text-left text-base', className)}
      {...props}
    />
  )
}

export function ItemCardHeaderDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-left text-sm text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function ItemCardItems({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      className={cn('m-0 list-none overflow-hidden p-0', className)}
      {...props}
    />
  )
}

export function ItemCardItem({
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      className={cn(
        'relative flex min-h-15 items-center justify-between gap-4 px-4 py-3',
        "after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-border after:content-['']",
        'last:after:hidden',
        className,
      )}
      {...props}
    />
  )
}

export function ItemCardItemContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex min-w-0 flex-col gap-0.5', className)}
      {...props}
    />
  )
}

export function ItemCardItemTitle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-1.5 text-left text-base', className)}
      {...props}
    />
  )
}

export function ItemCardItemDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('text-left text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export function ItemCardItemAction({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('relative flex items-center gap-1', className)}
      {...props}
    />
  )
}

export function ItemCardFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative flex min-h-12 items-center justify-center px-4 py-2.5',
        "before:absolute before:right-0 before:top-0 before:left-0 before:block before:h-px before:bg-border before:content-['']",
        className,
      )}
      {...props}
    />
  )
}
