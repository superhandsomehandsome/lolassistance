import { globalShortcut } from 'electron'
import { addPendingSpell } from './pending-spells'

let currentHotkey: string | null = null

export function registerSpellHotkey(key?: string): boolean {
  const hotkey = key?.trim() || 'F6'

  if (currentHotkey) {
    globalShortcut.unregister(currentHotkey)
    currentHotkey = null
  }

  try {
    const success = globalShortcut.register(hotkey, () => {
      addPendingSpell()
    })
    if (success) {
      currentHotkey = hotkey
    }
    return success
  } catch {
    return false
  }
}
