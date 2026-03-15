import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { cn } from '~/lib/utils'

export interface AnimatedToggleProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  icons?: { on: ReactNode; off: ReactNode }
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  label?: string
  className?: string
}

const SPRING = {
  type: 'spring' as const,
  duration: 0.25,
  bounce: 0.1,
}

const SIZES = {
  sm: {
    track: 'w-9 h-5',
    thumb: 'size-4',
    thumbTranslate: 16,
    icon: 'size-2.5',
  },
  md: {
    track: 'w-11 h-6',
    thumb: 'size-5',
    thumbTranslate: 20,
    icon: 'size-3',
  },
  lg: {
    track: 'w-[52px] h-7',
    thumb: 'size-6',
    thumbTranslate: 24,
    icon: 'size-3.5',
  },
}

export function AnimatedToggle({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  icons,
  size = 'md',
  disabled = false,
  label,
  className,
}: AnimatedToggleProps) {
  const shouldReduceMotion = useReducedMotion()
  const [internalChecked, setInternalChecked] = useState(defaultChecked)

  const isControlled = controlledChecked !== undefined
  const checked = isControlled ? controlledChecked : internalChecked

  const handleToggle = useCallback(() => {
    if (disabled) return
    const newValue = !checked
    if (!isControlled) setInternalChecked(newValue)
    onChange?.(newValue)
  }, [checked, disabled, isControlled, onChange])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        handleToggle()
      }
    },
    [handleToggle],
  )

  const sizeConfig = SIZES[size]
  const thumbTranslate = checked ? sizeConfig.thumbTranslate : 0

  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        disabled && 'cursor-not-allowed opacity-50',
        sizeConfig.track,
        className,
      )}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      role="switch"
      type="button"
    >
      <motion.span
        animate={
          shouldReduceMotion
            ? { x: thumbTranslate }
            : { x: thumbTranslate, borderRadius: 9999 }
        }
        className={cn(
          'pointer-events-none flex items-center justify-center rounded-full border border-border bg-background shadow-sm',
          sizeConfig.thumb,
        )}
        initial={false}
        style={{ borderRadius: 9999 }}
        transition={shouldReduceMotion ? { duration: 0 } : SPRING}
      >
        {icons && (
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, scale: 1, rotate: 0 }
              }
              className={cn(
                'flex items-center justify-center text-muted-foreground',
                sizeConfig.icon,
              )}
              exit={
                shouldReduceMotion
                  ? { opacity: 0, transition: { duration: 0 } }
                  : { opacity: 0, scale: 0.5, rotate: -90 }
              }
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.5, rotate: 90 }
              }
              key={checked ? 'on' : 'off'}
              transition={shouldReduceMotion ? { duration: 0 } : SPRING}
            >
              {checked ? icons.on : icons.off}
            </motion.span>
          </AnimatePresence>
        )}
      </motion.span>
    </button>
  )
}
