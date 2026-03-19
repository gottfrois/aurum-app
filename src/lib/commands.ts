import {
  ArrowLeftRight,
  FolderOpen,
  Keyboard,
  Landmark,
  LayoutDashboard,
  Settings,
  Sparkles,
  Tags,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { Hotkey } from '~/lib/hotkeys'

export interface CommandDefinition {
  id: string
  label: string
  group: string
  icon?: ComponentType<{ className?: string }>
  hotkey?: Hotkey
  hidden?: boolean
  keywords?: string[]
}

export const COMMAND_DEFINITIONS: Record<string, CommandDefinition> = {
  'palette.toggle': {
    id: 'palette.toggle',
    label: 'Open command palette',
    group: 'General',
    hotkey: { keys: 'mod+k', scope: 'system' },
    hidden: true,
  },
  'sidebar.toggle': {
    id: 'sidebar.toggle',
    label: 'Toggle sidebar',
    group: 'General',
    hotkey: { keys: 'mod+b', scope: 'system' },
    hidden: true,
  },
  'nav.dashboard': {
    id: 'nav.dashboard',
    label: 'Go to Dashboard',
    group: 'Navigation',
    icon: LayoutDashboard,
    hotkey: { keys: 'g+d', scope: 'global' },
  },
  'nav.transactions': {
    id: 'nav.transactions',
    label: 'Go to Transactions',
    group: 'Navigation',
    icon: ArrowLeftRight,
    hotkey: { keys: 'g+t', scope: 'global' },
  },
  'nav.accounts': {
    id: 'nav.accounts',
    label: 'Go to Accounts',
    group: 'Navigation',
    icon: Landmark,
    hotkey: { keys: 'g+a', scope: 'global' },
  },
  'nav.settings': {
    id: 'nav.settings',
    label: 'Go to Settings',
    group: 'Navigation',
    icon: Settings,
    hotkey: { keys: 'g+s', scope: 'global' },
  },
  'selection.change-labels': {
    id: 'selection.change-labels',
    label: 'Change or add labels',
    group: 'Selection',
    icon: Tags,
  },
  'selection.change-category': {
    id: 'selection.change-category',
    label: 'Change category',
    group: 'Selection',
    icon: FolderOpen,
  },
  'selection.clear': {
    id: 'selection.clear',
    label: 'Clear selection',
    group: 'Selection',
    hotkey: { keys: 'escape', scope: 'global' },
    hidden: true,
  },
  'ai.filter': {
    id: 'ai.filter',
    label: 'Ask AI to filter...',
    group: 'AI',
    icon: Sparkles,
  },
  'shortcuts.show': {
    id: 'shortcuts.show',
    label: 'Keyboard shortcuts',
    group: 'General',
    icon: Keyboard,
    hotkey: { keys: 'shift+/', scope: 'global' },
    hidden: true,
  },
}

export function getCommandDefinition(
  id: string,
): CommandDefinition | undefined {
  return COMMAND_DEFINITIONS[id]
}
