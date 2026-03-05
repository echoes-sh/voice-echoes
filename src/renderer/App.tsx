import { useState, useRef, useEffect, useCallback } from 'react'
import Pill, { PillState } from './components/Pill'
import { WaveformHandle } from './components/Waveform'
import { useRecorder } from './hooks/useRecorder'

export default function App() {
  const [pillState, setPillState] = useState<PillState>('idle')
  const [visible, setVisible] = useState(false)
  const [deviceId, setDeviceId] = useState<string>('default')

  const streamRef = useRef<MediaStream | null>(null)
  const waveformRef = useRef<WaveformHandle | null>(null)

  // Load persisted device ID on mount
  useEffect(() => {
    window.electronAPI.settingsGet().then((s) => {
      if (s.deviceId) setDeviceId(s.deviceId)
    })
  }, [])

  const handleAudioReady = useCallback(async (blob: Blob, mimeType: string) => {
    setPillState('processing')
    waveformRef.current?.stop()

    const buffer = await blob.arrayBuffer()
    const result = await window.electronAPI.audioReady({ buffer, mimeType })

    if (result.error) console.error('[App] transcription error:', result.error)

    setVisible(false)
    setPillState('idle')
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const { startRecording, stopRecording } = useRecorder(handleAudioReady)

  const startMic = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId && deviceId !== 'default'
          ? { deviceId: { exact: deviceId } }
          : true,
        video: false
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      waveformRef.current?.start(stream)
      startRecording(stream)
      setPillState('recording')
      setVisible(true)
    } catch (err) {
      console.error('[App] mic access failed:', err)
    }
  }, [startRecording, deviceId])

  useEffect(() => {
    window.electronAPI.onRecorderStart(() => startMic())
    window.electronAPI.onRecorderStop(() => stopRecording())
  }, [startMic, stopRecording])

  return (
    <Pill
      state={pillState}
      visible={visible}
      streamRef={streamRef}
      waveformRef={waveformRef}
    />
  )
}
