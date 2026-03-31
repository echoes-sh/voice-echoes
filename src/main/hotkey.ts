import { globalShortcut, BrowserWindow, screen } from 'electron'
import { captureActiveWindow } from './focus'

type AppState = 'idle' | 'recording' | 'processing'

let state: AppState = 'idle'
let activeWindowId: string | null = null
let cancelShortcutRegistered = false

export function getState(): AppState {
  return state
}

export function setState(newState: AppState): void {
  state = newState
}

export function getActiveWindowId(): string | null {
  return activeWindowId
}

export function setupHotkey(pill: BrowserWindow): void {
  // Keeps in-memory registration state aligned after globalShortcut.unregisterAll()
  cancelShortcutRegistered = false
  const key = process.env.HOTKEY || 'Ctrl+Shift+Space'

  try {
    const ok = globalShortcut.register(key, () => {
      handleHotkey(pill)
    })
    if (!ok) {
      console.error(`[hotkey] "${key}" is already claimed by another app — change HOTKEY in settings`)
    } else {
      console.log(`[hotkey] Registered: ${key}`)
    }
  } catch (err) {
    console.error(`[hotkey] Invalid accelerator "${key}":`, (err as Error).message)
    console.error('[hotkey] Open Settings to set a valid hotkey (e.g. Ctrl+Shift+Space)')
  }
}

function getCancelHotkey(): string {
  return process.env.CANCEL_HOTKEY || 'Ctrl+C'
}

function registerCancelHotkey(pill: BrowserWindow): void {
  if (cancelShortcutRegistered) return

  const key = getCancelHotkey()
  try {
    const ok = globalShortcut.register(key, () => {
      handleCancelHotkey(pill)
    })
    if (!ok) {
      console.error(`[hotkey] Cancel key "${key}" is already claimed by another app`)
      return
    }
    cancelShortcutRegistered = true
    console.log(`[hotkey] Cancel shortcut active: ${key}`)
  } catch (err) {
    console.error(`[hotkey] Invalid cancel accelerator "${key}":`, (err as Error).message)
  }
}

function unregisterCancelHotkey(): void {
  if (!cancelShortcutRegistered) return
  const key = getCancelHotkey()
  globalShortcut.unregister(key)
  cancelShortcutRegistered = false
  console.log(`[hotkey] Cancel shortcut disabled: ${key}`)
}

function handleHotkey(pill: BrowserWindow): void {
  console.log('[hotkey] fired, state:', state)

  if (state === 'processing') return

  if (state === 'idle') {
    activeWindowId = captureActiveWindow()
    console.log('[hotkey] captured window:', activeWindowId)
    state = 'recording'

    // Reposition pill to the current display/space
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const { width: sw, height: sh } = display.workAreaSize
    const { x: ox, y: oy } = display.workArea
    const pillW = 200
    const pillH = 44
    pill.setPosition(
      ox + Math.round((sw - pillW) / 2),
      oy + sh - pillH - 24
    )

    registerCancelHotkey(pill)
    pill.showInactive()
    pill.webContents.send('recorder:start')
  } else if (state === 'recording') {
    state = 'processing'
    unregisterCancelHotkey()
    pill.webContents.send('recorder:stop')
  }
}

function handleCancelHotkey(pill: BrowserWindow): void {
  console.log('[hotkey] cancel fired, state:', state)
  if (state !== 'recording') return

  unregisterCancelHotkey()
  state = 'idle'
  pill.webContents.send('recorder:cancel')
  pill.hide()
}
