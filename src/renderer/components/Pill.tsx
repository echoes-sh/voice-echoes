import { useRef } from 'react'
import styles from '../styles/Pill.module.css'
import Waveform, { WaveformHandle } from './Waveform'

export type PillState = 'idle' | 'recording' | 'processing'

interface PillProps {
  state: PillState
  visible: boolean
  streamRef: React.RefObject<MediaStream | null>
  waveformRef: React.RefObject<WaveformHandle | null>
}

export default function Pill({ state, visible, waveformRef }: PillProps) {
  if (!visible) return null

  return (
    <div className={styles.pill}>
      <div className={`${styles.dot} ${styles[state]}`} />
      <div className={styles.waveformContainer}>
        <Waveform ref={waveformRef} />
      </div>
    </div>
  )
}
