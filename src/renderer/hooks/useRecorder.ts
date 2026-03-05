import { useRef, useCallback } from 'react'

interface UseRecorderReturn {
  startRecording: (stream: MediaStream) => void
  stopRecording: () => void
  cancelRecording: () => void
}

export function useRecorder(
  onAudioReady: (blob: Blob, mimeType: string) => void
): UseRecorderReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const discardOnStopRef = useRef(false)

  const startRecording = useCallback((stream: MediaStream) => {
    chunksRef.current = []
    discardOnStopRef.current = false

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : ''

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const finalMimeType = recorder.mimeType || 'audio/webm'
      if (!discardOnStopRef.current) {
        const blob = new Blob(chunksRef.current, { type: finalMimeType })
        onAudioReady(blob, finalMimeType)
      }
      discardOnStopRef.current = false
      chunksRef.current = []
      mediaRecorderRef.current = null
    }

    recorder.start(100)
  }, [onAudioReady])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      discardOnStopRef.current = true
      mediaRecorderRef.current.stop()
      return
    }
    discardOnStopRef.current = false
    chunksRef.current = []
  }, [])

  return { startRecording, stopRecording, cancelRecording }
}
