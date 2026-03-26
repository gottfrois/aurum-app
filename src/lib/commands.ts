import {
  ArrowLeftRight,
  Command,
  EyeOff,
  Keyboard,
  Landmark,
  LayoutDashboard,
  PanelLeft,
  Pencil,
  Settings,
  Sparkles,
  Sticker,
  Tag,
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
    icon: Command,
    hotkey: { keys: 'mod+k', scope: 'system' },
    hidden: true,
  },
  'sidebar.toggle': {
    id: 'sidebar.toggle',
    label: 'Toggle sidebar',
    group: 'General',
    icon: PanelLeft,
    hotkey: { keys: 'mod+b', scope: 'global' },
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
    label: 'Change or add labels...',
    group: 'Selection',
    icon: Sticker,
  },
  'selection.change-category': {
    id: 'selection.change-category',
    label: 'Change category...',
    group: 'Selection',
    icon: Tag,
  },
  'selection.change-description': {
    id: 'selection.change-description',
    label: 'Change description...',
    group: 'Selection',
    icon: Pencil,
  },
  'selection.toggle-exclusion': {
    id: 'selection.toggle-exclusion',
    label: 'Change budget visibility...',
    group: 'Selection',
    icon: EyeOff,
  },
  'selection.clear': {
    id: 'selection.clear',
    label: 'Clear selection',
    group: 'Selection',
    hotkey: { keys: 'escape', scope: 'global' },
    hidden: true,
  },
  'connection.add': {
    id: 'connection.add',
    label: 'Add Connection',
    group: 'General',
    icon: Landmark,
    hotkey: { keys: 'shift+c', scope: 'global' },
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
    hotkey: { keys: '?', scope: 'global' },
    hidden: true,
  },
}

export function getCommandDefinition(
  id: string,
): CommandDefinition | undefined {
  return COMMAND_DEFINITIONS[id]
}
