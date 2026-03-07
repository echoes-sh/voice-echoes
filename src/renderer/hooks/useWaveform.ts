import { useRef, useEffect, useCallback } from 'react'

export function useWaveform(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number>(0)
  const activeRef = useRef(false)

  const drawFrame = useCallback(() => {
    if (!activeRef.current) return

    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }

    const cCtx = canvas.getContext('2d')
    if (!cCtx) return

    // Reset transform at start of each frame
    cCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cCtx.clearRect(0, 0, w, h)

    const bufLen = analyser.frequencyBinCount // 32
    const data = new Uint8Array(bufLen)
    analyser.getByteFrequencyData(data)

    const barCount = 16 // use first 16 bins for good visuals
    const barW = (w / barCount) * 0.6
    const gap = (w / barCount) * 0.4
    const centerY = h / 2

    for (let i = 0; i < barCount; i++) {
      const value = data[i] / 255
      const barH = Math.max(3, value * centerY * 1.8)
      const x = i * (barW + gap) + gap / 2

      const opacity = 0.2 + value * 0.8
      cCtx.fillStyle = `rgba(255, 255, 255, ${opacity})`
      cCtx.beginPath()
      cCtx.roundRect(x, centerY - barH, barW, barH * 2, 2)
      cCtx.fill()
    }

    rafRef.current = requestAnimationFrame(drawFrame)
  }, [canvasRef])

  const start = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.75

    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
    // No connection to destination — prevents audio playback

    audioCtxRef.current = ctx
    analyserRef.current = analyser
    sourceRef.current = source
    activeRef.current = true

    rafRef.current = requestAnimationFrame(drawFrame)
  }, [drawFrame])

  const stop = useCallback(() => {
    activeRef.current = false
    cancelAnimationFrame(rafRef.current)
    sourceRef.current?.disconnect()
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    sourceRef.current = null

    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [canvasRef])

  useEffect(() => {
    return () => {
      activeRef.current = false
      cancelAnimationFrame(rafRef.current)
      audioCtxRef.current?.close()
    }
  }, [])

  return { start, stop }
}
