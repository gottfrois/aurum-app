export type HotkeyScope = 'global' | 'system'

export interface Hotkey {
  keys: string
  scope?: HotkeyScope
}

export interface FormattedHotkey {
  keys: string[][]
}

type Platform = 'mac' | 'windows' | 'other'

export function isMac(userAgent = navigator.userAgent): boolean {
  return userAgent.toLowerCase().includes('mac')
}

function isWindows(userAgent = navigator.userAgent): boolean {
  return userAgent.toLowerCase().includes('windows')
}

function platform(userAgent = navigator.userAgent): Platform {
  if (isMac(userAgent)) return 'mac'
  if (isWindows(userAgent)) return 'windows'
  return 'other'
}

const keySymbols: Record<string, string> = {
  alt: 'Alt',
  backspace: 'Backspace',
  comma: ',',
  ctrl: 'Ctrl',
  down: '↓',
  enter: 'Enter',
  esc: 'Esc',
  escape: 'Esc',
  left: '←',
  meta: 'Meta',
  mod: 'Ctrl',
  right: '→',
  shift: 'Shift',
  space: 'Space',
  tab: 'Tab',
  up: '↑',
  '/': '/',
}

const macSymbols: Record<string, string> = {
  alt: '⌥',
  backspace: '⌫',
  ctrl: '⌃',
  enter: '⏎',
  meta: '⌘',
  mod: '⌘',
  shift: '⇧',
  space: '⎵',
  tab: '⇥',
}

const windowsSymbols: Record<string, string> = {
  meta: 'Win',
}

function getKeySymbol(key: string, p: Platform): string {
  const k = key.toLowerCase()
  if (p === 'mac') return macSymbols[k] ?? keySymbols[k] ?? key.toUpperCase()
  return keySymbols[k] ?? key.toUpperCase()
}

function getModifierSymbol(modifier: string, p: Platform): string {
  const m = modifier.toLowerCase()
  if (p === 'mac')
    return macSymbols[m] ?? keySymbols[m] ?? modifier.toUpperCase()
  if (p === 'windows')
    return windowsSymbols[m] ?? keySymbols[m] ?? modifier.toUpperCase()
  return keySymbols[m] ?? modifier.toUpperCase()
}

function formatKeysCombination(keys: string, userAgent?: string): string[] {
  const p = platform(userAgent)
  const parts = keys.split('+')
  const modifiers = parts.slice(0, -1)
  const key = parts[parts.length - 1] ?? ''

  const formattedModifiers = modifiers.map((mod) => getModifierSymbol(mod, p))
  const formattedKey = getKeySymbol(key, p)

  return [...formattedModifiers, formattedKey].filter(Boolean)
}

export function formatHotkey(
  hotkey: Hotkey,
  userAgent?: string,
): FormattedHotkey {
  const keys = hotkey.keys
    .split(/\s*,\s*/)
    .filter(Boolean)
    .map((combination) => formatKeysCombination(combination, userAgent))

  return { keys }
}
