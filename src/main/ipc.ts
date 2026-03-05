import { ipcMain, BrowserWindow, globalShortcut } from 'electron'
import { transcribeAudio } from './transcribe'
import { typeIntoWindow } from './focus'
import { getActiveWindowId, setState, setupHotkey } from './hotkey'
import { readSettings, writeSettings } from './settings'

export function registerIpcHandlers(pill: BrowserWindow): void {
  ipcMain.handle('settings:get', () => readSettings())

  ipcMain.handle(
    'settings:save',
    (_event, apiKey: string, hotkey: string, deviceId: string) => {
      try {
        writeSettings(apiKey, hotkey, deviceId)

        // Re-register hotkey live without restart
        globalShortcut.unregisterAll()
        setupHotkey(pill)

        return {}
      } catch (err) {
        console.error('[ipc] settings:save error:', err)
        return { error: (err as Error).message }
      }
    }
  )

  ipcMain.handle(
    'recorder:audio-ready',
    async (_event, payload: { buffer: ArrayBuffer; mimeType: string }) => {
      try {
        const text = await transcribeAudio(payload.buffer, payload.mimeType)
        console.log('[ipc] transcribed:', text)

        const windowId = getActiveWindowId()
        if (text && windowId) {
          await typeIntoWindow(windowId, text)
        }

        pill.hide()
        setState('idle')
        return { text, error: null }
      } catch (err) {
        console.error('[ipc] error:', err)
        pill.hide()
        setState('idle')
        return { text: null, error: (err as Error).message }
      }
    }
  )
}
