import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../../shared/types'

let settings: AppSettings = {}

function getSettingsPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const path = getSettingsPath()
    if (existsSync(path)) {
      settings = JSON.parse(readFileSync(path, 'utf-8')) as AppSettings
    }
  } catch {
    settings = {}
  }
  return settings
}

export function getSettings(): AppSettings {
  return settings
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  settings = { ...settings, ...partial }
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  return settings
}
