import { BrowserWindow, screen, globalShortcut, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { GamePhase } from '../../shared/types'

let overlayWindow: BrowserWindow | null = null
let registered = false

function createOverlay(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width } = primaryDisplay.workAreaSize

  const win = new BrowserWindow({
    width: 360,
    height: 540,
    x: width - 380,
    y: 20,
    transparent: true,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 最高级 alwaysOnTop，能覆盖大多数无边框窗口模式的游戏
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // 默认鼠标事件穿透，让游戏可以正常操作
  // forward: true 让 overlay 中的 renderer 仍然收到 mousemove 事件来检测鼠标是否进入交互区域
  win.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/overlay.html'))
  }

  win.on('closed', () => {
    overlayWindow = null
  })

  return win
}

export function showOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.showInactive()
    return
  }
  overlayWindow = createOverlay()
  overlayWindow.showInactive()
}

export function hideOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
}

export function destroyOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close()
  }
  overlayWindow = null
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}

export function broadcastToOverlay(channel: string, payload: unknown): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, payload)
  }
}

export function registerOverlayToggleHotkey(): void {
  if (registered) return
  try {
    globalShortcut.register('F7', () => {
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        showOverlay()
      } else if (overlayWindow.isVisible()) {
        hideOverlay()
      } else {
        showOverlay()
      }
    })
    registered = true
  } catch {
    console.warn('[Overlay] Failed to register F7 hotkey')
  }

  // renderer 通知主进程：鼠标进入/离开 overlay 交互区域
  ipcMain.on('overlay:set-ignore-mouse', (_event, ignore: boolean) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    if (ignore) {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true })
    } else {
      overlayWindow.setIgnoreMouseEvents(false)
    }
  })

  // renderer 请求拖动窗口
  ipcMain.on('overlay:start-drag', () => {
    // no-op, drag is handled by -webkit-app-region: drag in CSS
  })
}

export function handlePhaseForOverlay(phase: GamePhase): void {
  // 避免进入游戏时自动弹出/抢占体验；需要时由用户按 F7 手动显示。
  if (phase === 'EndOfGame' || phase === 'None') {
    hideOverlay()
  }
}
