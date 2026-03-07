import { useState, useCallback, useEffect } from 'react'
import Pill, { PillState } from './components/Pill'
import { useRecorder } from './hooks/useRecorder'

export default function App() {
  const [pillState, setPillState] = useState<PillState>('idle')
  const [visible, setVisible] = useState(false)
  const [deviceId, setDeviceId] = useState<string>('default')

  // Load persisted device ID on mount
  useEffect(() => {
    window.electronAPI.settingsGet().then((s) => {
      if (s.deviceId) setDeviceId(s.deviceId)
    })
  }, [])

  const handleAudioReady = useCallback(async (blob: Blob, mimeType: string) => {
    setPillState('processing')

    const buffer = await blob.arrayBuffer()
    const result = await window.electronAPI.audioReady({ buffer, mimeType })

    if (result.error) console.error('[App] transcription error:', result.error)

    setVisible(false)
    setPillState('idle')
  }, [])

  const { startRecording, stopRecording, cancelRecording } = useRecorder(handleAudioReady)

  const handleStreamReady = useCallback((stream: MediaStream) => {
    startRecording(stream)
  }, [startRecording])

  const startMic = useCallback(() => {
    setPillState('recording')
    setVisible(true)
  }, [])

  const cancelMic = useCallback(() => {
    cancelRecording()
    setVisible(false)
    setPillState('idle')
  }, [cancelRecording])

  useEffect(() => {
    window.electronAPI.onRecorderStart(() => startMic())
    window.electronAPI.onRecorderStop(() => stopRecording())
    window.electronAPI.onRecorderCancel(() => cancelMic())
  }, [startMic, stopRecording, cancelMic])

  return (
    <Pill
      state={pillState}
      visible={visible}
      deviceId={deviceId}
      onStreamReady={handleStreamReady}
      onStreamEnd={() => {}}
    />
  )
}
