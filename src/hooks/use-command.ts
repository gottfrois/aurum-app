import * as React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import type { CommandEntry } from '~/contexts/command-context'
import { useCommandDispatch } from '~/contexts/command-context'
import { getCommandDefinition } from '~/lib/commands'

interface UseCommandOptions {
  handler: () => void
  disabled?: boolean
  label?: string
  hidden?: boolean
  view?: (props: { onBack: () => void }) => React.ReactNode
}

export function useCommand(
  commandId: string,
  options: UseCommandOptions,
): void {
  const { register } = useCommandDispatch()
  const { t } = useTranslation()
  const definition = getCommandDefinition(commandId)

  // Use refs for callback props so the registered entry stays stable
  // and doesn't trigger re-registration on every render
  const handlerRef = React.useRef(options.handler)
  const viewRef = React.useRef(options.view)
  React.useEffect(() => {
    handlerRef.current = options.handler
    viewRef.current = options.view
  })

  const entry = React.useMemo<CommandEntry>(
    () => ({
      id: commandId,
      label:
        options.label ??
        (definition?.labelKey ? t(definition.labelKey) : commandId),
      group: definition?.groupKey
        ? t(definition.groupKey)
        : t('commands.groups.general'),
      icon: definition?.icon,
      hotkey: definition?.hotkey,
      handler: () => handlerRef.current(),
      disabled: options.disabled,
      hidden: options.hidden ?? definition?.hidden,
      keywords: definition?.keywords,
      view: viewRef.current ? (props) => viewRef.current?.(props) : undefined,
    }),
    [commandId, options.label, options.disabled, options.hidden, definition, t],
  )

  React.useEffect(() => {
    return register([entry])
  }, [register, entry])

  const hotkey = definition?.hotkey
  const scope = hotkey?.scope ?? 'global'
  // Use event.key matching for symbol keys (e.g. "?") that don't map to
  // a predictable event.code. Modifier combos (mod+k) and named keys
  // (escape) work correctly with the default code-based matching.
  const hasModifier = hotkey?.keys
    ? /\b(mod|ctrl|alt|meta|shift)\b/i.test(hotkey.keys)
    : false
  // Only use event.key matching for symbol keys (not alphanumeric)
  // This allows "c" to work without conflicting with "mod+c" (copy)
  const isSymbolKey =
    !!hotkey?.keys &&
    !hasModifier &&
    !/^[a-z0-9]$/i.test(hotkey.keys.toLowerCase())
  const needsUseKey = isSymbolKey

  useHotkeys(
    hotkey?.keys ?? '',
    () => {
      if (!options.disabled) {
        handlerRef.current()
      }
    },
    {
      enabled: !!hotkey && !options.disabled,
      enableOnFormTags: scope === 'system',
      enableOnContentEditable: scope === 'system',
      preventDefault: true,
      useKey: needsUseKey,
    },
    [options.disabled, needsUseKey],
  )
}
