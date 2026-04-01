import {
  ArrowLeftRight,
  BotMessageSquare,
  Command,
  Eye,
  EyeOff,
  Keyboard,
  Landmark,
  Layers,
  LayoutDashboard,
  Lock,
  Monitor,
  Moon,
  PanelLeft,
  Pencil,
  Plus,
  Settings,
  Star,
  Sticker,
  Sun,
  Tag,
  Trash2,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { Hotkey } from '~/lib/hotkeys'

export interface CommandDefinition {
  id: string
  /** Translation key for the label — resolved via t() at render time */
  labelKey: string
  /** Translation key for the group — resolved via t() at render time */
  groupKey: string
  /** @deprecated Use labelKey instead. Kept for backward compatibility during migration. */
  label?: string
  /** @deprecated Use groupKey instead. */
  group?: string
  icon?: ComponentType<{ className?: string }>
  hotkey?: Hotkey
  hidden?: boolean
  keywords?: string[]
}

export const COMMAND_DEFINITIONS: Record<string, CommandDefinition> = {
  'palette.toggle': {
    id: 'palette.toggle',
    labelKey: 'commands.openCommandPalette',
    groupKey: 'commands.groups.general',
    icon: Command,
    hotkey: { keys: 'mod+k', scope: 'system' },
    hidden: true,
  },
  'sidebar.toggle': {
    id: 'sidebar.toggle',
    labelKey: 'commands.toggleSidebar',
    groupKey: 'commands.groups.general',
    icon: PanelLeft,
    hotkey: { keys: 'mod+b', scope: 'global' },
    hidden: true,
  },
  'nav.dashboard': {
    id: 'nav.dashboard',
    labelKey: 'commands.goToDashboard',
    groupKey: 'commands.groups.navigation',
    icon: LayoutDashboard,
    hotkey: { keys: 'g+d', scope: 'global' },
  },
  'nav.transactions': {
    id: 'nav.transactions',
    labelKey: 'commands.goToTransactions',
    groupKey: 'commands.groups.navigation',
    icon: ArrowLeftRight,
    hotkey: { keys: 'g+t', scope: 'global' },
  },
  'nav.accounts': {
    id: 'nav.accounts',
    labelKey: 'commands.goToAccounts',
    groupKey: 'commands.groups.navigation',
    icon: Landmark,
    hotkey: { keys: 'g+a', scope: 'global' },
  },
  'nav.settings': {
    id: 'nav.settings',
    labelKey: 'commands.goToSettings',
    groupKey: 'commands.groups.navigation',
    icon: Settings,
    hotkey: { keys: 'g+s', scope: 'global' },
  },
  'nav.views': {
    id: 'nav.views',
    labelKey: 'commands.goToViews',
    groupKey: 'commands.groups.navigation',
    icon: Layers,
    hotkey: { keys: 'g+v', scope: 'global' },
  },
  'view.create': {
    id: 'view.create',
    labelKey: 'commands.createView',
    groupKey: 'commands.groups.views',
    icon: Plus,
    keywords: ['save', 'filter', 'view'],
  },
  'view.toggle-favorite': {
    id: 'view.toggle-favorite',
    labelKey: 'commands.toggleViewFavorite',
    groupKey: 'commands.groups.views',
    icon: Star,
    hidden: true,
  },
  'view.rename': {
    id: 'view.rename',
    labelKey: 'commands.renameView',
    groupKey: 'commands.groups.views',
    icon: Pencil,
    hidden: true,
  },
  'view.delete': {
    id: 'view.delete',
    labelKey: 'commands.deleteView',
    groupKey: 'commands.groups.views',
    icon: Trash2,
    hidden: true,
  },
  'selection.change-labels': {
    id: 'selection.change-labels',
    labelKey: 'commands.changeLabels',
    groupKey: 'commands.groups.selection',
    icon: Sticker,
  },
  'selection.change-category': {
    id: 'selection.change-category',
    labelKey: 'commands.changeCategory',
    groupKey: 'commands.groups.selection',
    icon: Tag,
  },
  'selection.change-description': {
    id: 'selection.change-description',
    labelKey: 'commands.changeDescription',
    groupKey: 'commands.groups.selection',
    icon: Pencil,
  },
  'selection.toggle-exclusion': {
    id: 'selection.toggle-exclusion',
    labelKey: 'commands.changeBudget',
    groupKey: 'commands.groups.selection',
    icon: EyeOff,
  },
  'selection.clear': {
    id: 'selection.clear',
    labelKey: 'commands.clearSelection',
    groupKey: 'commands.groups.selection',
    hotkey: { keys: 'escape', scope: 'global' },
    hidden: true,
  },
  'connection.add': {
    id: 'connection.add',
    labelKey: 'commands.addConnection',
    groupKey: 'commands.groups.general',
    icon: Landmark,
    hotkey: { keys: 'c', scope: 'global' },
  },
  'vault.lock': {
    id: 'vault.lock',
    labelKey: 'commands.lockVault',
    groupKey: 'commands.groups.general',
    icon: Lock,
    hotkey: { keys: 'alt+l', scope: 'global' },
  },
  'privacy.toggle': {
    id: 'privacy.toggle',
    labelKey: 'commands.toggleBalances',
    groupKey: 'commands.groups.general',
    icon: Eye,
    hotkey: { keys: 'alt+h', scope: 'global' },
  },
  'ai.chat': {
    id: 'ai.chat',
    labelKey: 'commands.openAgentChat',
    groupKey: 'commands.groups.ai',
    icon: BotMessageSquare,
    hotkey: { keys: 'mod+j', scope: 'global' },
    keywords: ['agent', 'chat', 'ai', 'assistant', 'bunkr'],
  },
  'shortcuts.show': {
    id: 'shortcuts.show',
    labelKey: 'commands.keyboardShortcuts',
    groupKey: 'commands.groups.general',
    icon: Keyboard,
    hotkey: { keys: '?', scope: 'global' },
    hidden: true,
  },
  'theme.light': {
    id: 'theme.light',
    labelKey: 'commands.switchToLight',
    groupKey: 'commands.groups.theme',
    icon: Sun,
    keywords: ['theme', 'appearance', 'light', 'mode'],
  },
  'theme.dark': {
    id: 'theme.dark',
    labelKey: 'commands.switchToDark',
    groupKey: 'commands.groups.theme',
    icon: Moon,
    keywords: ['theme', 'appearance', 'dark', 'mode'],
  },
  'theme.system': {
    id: 'theme.system',
    labelKey: 'commands.switchToSystem',
    groupKey: 'commands.groups.theme',
    icon: Monitor,
    keywords: ['theme', 'appearance', 'system', 'mode', 'auto'],
  },
}

export function getCommandDefinition(
  id: string,
): CommandDefinition | undefined {
  return COMMAND_DEFINITIONS[id]
}
