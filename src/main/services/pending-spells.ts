import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { PendingSpellRecord } from '../../shared/types'

let mainWindow: BrowserWindow | null = null
const pendingSpells: PendingSpellRecord[] = []

export function setPendingSpellsWindow(win: BrowserWindow): void {
  mainWindow = win
}

function broadcast(channel: string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

export function addPendingSpell(): PendingSpellRecord {
  const record: PendingSpellRecord = {
    id: randomUUID(),
    timestamp: Date.now()
  }
  pendingSpells.push(record)
  broadcast(IPC_CHANNELS.SPELL_PENDING_ADD, record)
  return record
}

export function getPendingSpells(): PendingSpellRecord[] {
  return [...pendingSpells]
}

export function consumePendingSpell(): PendingSpellRecord | null {
  return pendingSpells.shift() ?? null
}

export function dismissPendingSpell(id: string): boolean {
  const index = pendingSpells.findIndex((record) => record.id === id)
  if (index < 0) return false
  pendingSpells.splice(index, 1)
  return true
}

export function clearPendingSpells(): void {
  pendingSpells.length = 0
}
