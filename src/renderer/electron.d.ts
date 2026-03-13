export {}

declare global {
  interface Window {
    electronAPI: {
      onRecorderStart: (cb: () => void) => void
      onRecorderStop: (cb: () => void) => void
      onRecorderCancel: (cb: () => void) => void
      audioReady: (payload: {
        buffer: ArrayBuffer
        mimeType: string
      }) => Promise<{ text: string | null; error: string | null }>

      settingsGet: () => Promise<{ apiKey: string; hotkey: string; deviceId: string }>
      settingsUsage: (apiKey?: string) => Promise<{
        monthUsageUsd: number | null
        creditRemainingUsd: number | null
        periodStart: string
        periodEnd: string
        fetchedAt: string
        error?: string
      }>
      settingsSave: (apiKey: string, hotkey: string, deviceId: string) => Promise<{ error?: string }>
      getAutoLaunch: () => Promise<boolean>
      setAutoLaunch: (enabled: boolean) => Promise<void>
      closeWindow: () => void
    }
  }
}
