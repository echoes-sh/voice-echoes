import { useRef, useCallback } from 'react'

interface UseRecorderReturn {
  startRecording: (stream: MediaStream) => void
  stopRecording: () => void
}

export function useRecorder(
  onAudioReady: (blob: Blob, mimeType: string) => void
): UseRecorderReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback((stream: MediaStream) => {
    chunksRef.current = []

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
      const blob = new Blob(chunksRef.current, { type: finalMimeType })
      onAudioReady(blob, finalMimeType)
      chunksRef.current = []
    }

    recorder.start(100)
  }, [onAudioReady])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  return { startRecording, stopRecording }
}
