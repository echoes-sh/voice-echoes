import styles from '../styles/Pill.module.css'
import { LiveWaveform } from './LiveWaveform'

export type PillState = 'idle' | 'recording' | 'processing'

interface PillProps {
  state: PillState
  visible: boolean
  deviceId: string
  onStreamReady: (stream: MediaStream) => void
  onStreamEnd: () => void
}

export default function Pill({ state, visible, deviceId, onStreamReady, onStreamEnd }: PillProps) {
  if (!visible) return null

  return (
    <div className={styles.pill}>
      <div className={styles.waveformContainer}>
        <LiveWaveform
          active={state === 'recording'}
          processing={state === 'processing'}
          deviceId={deviceId}
          height="100%"
          barWidth={2}
          barGap={1}
          barRadius={1}
          barColor="rgba(255, 255, 255, 0.9)"
          fadeEdges={true}
          fadeWidth={12}
          sensitivity={1.2}
          mode="static"
          onStreamReady={onStreamReady}
          onStreamEnd={onStreamEnd}
          onError={(err) => console.error('[LiveWaveform] mic error:', err)}
        />
      </div>
    </div>
  )
}
