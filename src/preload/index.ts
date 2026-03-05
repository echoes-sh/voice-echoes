import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  // ── Recorder ────────────────────────────────────────
  onRecorderStart: (cb: () => void) => {
    ipcRenderer.removeAllListeners('recorder:start')
    ipcRenderer.on('recorder:start', () => cb())
  },
  onRecorderStop: (cb: () => void) => {
    ipcRenderer.removeAllListeners('recorder:stop')
    ipcRenderer.on('recorder:stop', () => cb())
  },
  onRecorderCancel: (cb: () => void) => {
    ipcRenderer.removeAllListeners('recorder:cancel')
    ipcRenderer.on('recorder:cancel', () => cb())
  },
  audioReady: (payload: { buffer: ArrayBuffer; mimeType: string }) => {
    return ipcRenderer.invoke('recorder:audio-ready', payload)
  },

  // ── Settings ─────────────────────────────────────────
  settingsGet: (): Promise<{ apiKey: string; hotkey: string; deviceId: string }> => {
    return ipcRenderer.invoke('settings:get')
  },
  settingsSave: (apiKey: string, hotkey: string, deviceId: string): Promise<{ error?: string }> => {
    return ipcRenderer.invoke('settings:save', apiKey, hotkey, deviceId)
  },

  closeWindow: () => {
    ipcRenderer.send('window:close')
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
