export {}

declare global {
  interface Window {
    electronAPI: {
      onRecorderStart: (cb: () => void) => void
      onRecorderStop: (cb: () => void) => void
      audioReady: (payload: {
        buffer: ArrayBuffer
        mimeType: string
      }) => Promise<{ text: string | null; error: string | null }>

      settingsGet: () => Promise<{ apiKey: string; hotkey: string; deviceId: string }>
      settingsSave: (apiKey: string, hotkey: string, deviceId: string) => Promise<{ error?: string }>
    }
  }
}
