import { useRef, forwardRef, useImperativeHandle } from 'react'
import { useWaveform } from '../hooks/useWaveform'

export interface WaveformHandle {
  start: (stream: MediaStream) => void
  stop: () => void
}

const Waveform = forwardRef<WaveformHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { start, stop } = useWaveform(canvasRef)

  useImperativeHandle(ref, () => ({ start, stop }))

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
})

Waveform.displayName = 'Waveform'
export default Waveform
