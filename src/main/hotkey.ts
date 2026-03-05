import { globalShortcut, BrowserWindow } from 'electron'
import { captureActiveWindow } from './focus'

type AppState = 'idle' | 'recording' | 'processing'

let state: AppState = 'idle'
let activeWindowId: string | null = null

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

function handleHotkey(pill: BrowserWindow): void {
  console.log('[hotkey] fired, state:', state)

  if (state === 'processing') return

  if (state === 'idle') {
    activeWindowId = captureActiveWindow()
    console.log('[hotkey] captured window:', activeWindowId)
    state = 'recording'
    pill.showInactive()
    pill.webContents.send('recorder:start')
  } else if (state === 'recording') {
    state = 'processing'
    pill.webContents.send('recorder:stop')
  }
}
