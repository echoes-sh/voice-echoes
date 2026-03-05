import { app, BrowserWindow, screen } from 'electron'

// Disable GPU in WSL2 — avoids GPU process crash errors, falls back to software rendering
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

import { join } from 'path'
import { config } from 'dotenv'
import { setupTray } from './tray'
import { setupHotkey } from './hotkey'
import { registerIpcHandlers } from './ipc'

// Load .env
config({
  path: app.isPackaged
    ? join(app.getPath('userData'), '.env')
    : join(process.cwd(), '.env')
})

let pill: BrowserWindow | null = null
let settingsWin: BrowserWindow | null = null

function createPill(): BrowserWindow {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { width: sw, height: sh } = display.workAreaSize
  const { x: ox, y: oy } = display.workArea

  const pillW = 320
  const pillH = 72

  const win = new BrowserWindow({
    width: pillW,
    height: pillH,
    x: ox + Math.round((sw - pillW) / 2),
    y: oy + sh - pillH - 24,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    type: 'toolbar',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.webContents.on('did-finish-load', () => {
    console.log('[pill] renderer loaded and ready')
  })

  return win
}

export function openSettings(): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus()
    return
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x: ox, y: oy, width: sw, height: sh } = display.workArea

  settingsWin = new BrowserWindow({
    width: 460,
    height: 475,
    x: ox + Math.round((sw - 480) / 2),
    y: oy + Math.round((sh - 490) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    settingsWin.loadURL('http://localhost:5173/#settings')
  } else {
    settingsWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'settings' })
  }

  // Show only once content is ready to avoid white flash
  settingsWin.once('ready-to-show', () => {
    console.log('[settings] window ready, showing')
    settingsWin?.show()
    settingsWin?.focus()
  })

  settingsWin.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[settings] failed to load:', code, desc)
  })

  settingsWin.on('closed', () => { settingsWin = null })
}

app.whenReady().then(() => {
  pill = createPill()

  setupTray(pill)
  registerIpcHandlers(pill)
  setupHotkey(pill)

  // Open settings automatically if API key is missing, or always on first launch
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey === 'sk-your-key-here') {
    openSettings()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      pill = createPill()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { pill }
