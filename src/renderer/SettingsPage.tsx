import { useState, useEffect } from 'react'
import Settings from './Settings'

export default function SettingsPage() {
  const [initial, setInitial] = useState<{
    apiKey: string
    hotkey: string
    deviceId: string
  } | null>(null)

  useEffect(() => {
    window.electronAPI.settingsGet().then(setInitial)
  }, [])

  if (!initial) return null

  return (
    <Settings
      initialKey={initial.apiKey}
      initialHotkey={initial.hotkey}
      initialDeviceId={initial.deviceId}
      onSave={(key, hk, dev) => window.electronAPI.settingsSave(key, hk, dev)}
    />
  )
}
