import { useState, useCallback, useRef, useEffect } from 'react'
import styles from './styles/Settings.module.css'

interface SettingsProps {
  initialKey: string
  initialHotkey: string
  initialDeviceId: string
  onSave: (key: string, hotkey: string, deviceId: string) => Promise<{ error?: string }>
}

interface AudioDevice {
  deviceId: string
  label: string
}

type StatusState = { type: 'success' | 'error'; message: string } | null

interface OpenAIUsageSnapshot {
  creditsGrantedUsd: number | null
  creditsUsedUsd: number | null
  creditsRemainingUsd: number | null
  monthUsageUsd: number | null
  periodStart: string
  periodEnd: string
  fetchedAt: string
  error?: string
}

export default function Settings({ initialKey, initialHotkey, initialDeviceId, onSave }: SettingsProps) {
  const [apiKey, setApiKey]     = useState(initialKey)
  const [hotkey, setHotkey]     = useState(initialHotkey || 'F13')
  const [deviceId, setDeviceId] = useState(initialDeviceId || 'default')
  const [devices, setDevices]   = useState<AudioDevice[]>([])
  const [showKey, setShowKey]   = useState(false)
  const [recording, setRecording] = useState(false)
  const [status, setStatus]     = useState<StatusState>(null)
  const [saving, setSaving]     = useState(false)
  const [usage, setUsage]       = useState<OpenAIUsageSnapshot | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const hotkeyInputRef = useRef<HTMLInputElement>(null)

  const formatUsd = useCallback((value: number | null) => {
    if (value === null) return '—'
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(value)
  }, [])

  const formatDateTime = useCallback((iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'Unknown'
    return d.toLocaleString()
  }, [])

  // ── Enumerate audio inputs ─────────────────────────────
  useEffect(() => {
    async function loadDevices() {
      try {
        // Try getting permission first
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
      } catch (err) {
        console.warn('[settings] getUserMedia failed, trying enumerate anyway:', err)
      }

      try {
        const devs = await navigator.mediaDevices.enumerateDevices()
        const inputs = devs
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${i + 1}`
          }))
        setDevices(inputs)
        if (!initialDeviceId && inputs.length > 0) {
          setDeviceId(inputs[0].deviceId)
        }
      } catch (err) {
        console.error('[settings] enumerateDevices failed:', err)
      }
    }
    loadDevices()
  }, [initialDeviceId])

  const refreshUsage = useCallback(async (targetApiKey: string) => {
    setUsageLoading(true)
    setUsageError(null)
    try {
      const snapshot = await window.electronAPI.settingsUsage(targetApiKey.trim())
      setUsage(snapshot)
      setUsageError(snapshot.error ?? null)
    } catch (err) {
      setUsageError((err as Error).message)
    } finally {
      setUsageLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialKey.trim()) return
    void refreshUsage(initialKey)
  }, [initialKey, refreshUsage])

  // ── Key recorder ──────────────────────────────────────
  const startRecording = useCallback(() => {
    setRecording(true)
    setHotkey('Press a key…')
    hotkeyInputRef.current?.focus()
  }, [])

  const handleHotkeyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!recording) return
      e.preventDefault()

      const modifiers: string[] = []
      if (e.ctrlKey)  modifiers.push('Ctrl')
      if (e.altKey)   modifiers.push('Alt')
      if (e.shiftKey) modifiers.push('Shift')
      if (e.metaKey)  modifiers.push('Super')

      const skip = ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph']
      if (skip.includes(e.key)) return

      const keyMap: Record<string, string> = {
        ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down',
        ArrowLeft: 'Left', ArrowRight: 'Right',
        Escape: 'Escape', Tab: 'Tab', Enter: 'Return',
        Backspace: 'Backspace', Delete: 'Delete',
        '\\': 'Backslash', '/': 'Slash',
        '[': 'BracketLeft', ']': 'BracketRight',
        '`': 'Backquote', '-': 'Minus', '=': 'Equal',
        ';': 'Semicolon', "'": 'Quote', ',': 'Comma',
        '.': 'Period',
      }
      // Use e.code for reliable mapping of symbol keys
      const codeMap: Record<string, string> = {
        Backquote: 'Backquote', Minus: 'Minus', Equal: 'Equal',
        BracketLeft: 'BracketLeft', BracketRight: 'BracketRight',
        Backslash: 'Backslash', Semicolon: 'Semicolon',
        Quote: 'Quote', Comma: 'Comma', Period: 'Period',
        Slash: 'Slash',
      }
      const mapped = keyMap[e.key] ?? codeMap[e.code] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
      modifiers.push(mapped)
      setHotkey(modifiers.join('+'))
      setRecording(false)
    },
    [recording]
  )

  const handleHotkeyBlur = useCallback(() => {
    if (recording) {
      setHotkey(initialHotkey || 'F13')
      setRecording(false)
    }
  }, [recording, initialHotkey])

  // ── Save ──────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true)
    setStatus(null)
    try {
      const result = await onSave(apiKey, hotkey, deviceId)
      if (result?.error) {
        setStatus({ type: 'error', message: result.error })
      } else {
        setStatus({ type: 'success', message: 'Settings saved' })
        void refreshUsage(apiKey)
        setTimeout(() => setStatus(null), 3000)
      }
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }, [apiKey, hotkey, deviceId, onSave])

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="4" fill="currentColor" />
            <circle cx="18" cy="18" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
            <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.2" />
          </svg>
        </div>
        <div className={styles.headerText}>
          <div className={styles.appName}>Voice Echoes</div>
          <div className={styles.subtitle}>Settings</div>
        </div>
        <div className={styles.version}>v1.0</div>
        <button
          className={styles.closeBtn}
          onClick={() => window.electronAPI.closeWindow()}
          title="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      {/* API Key */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardLabel}>OpenAI API Key</div>
            <div className={styles.cardDesc}>Used for Whisper speech-to-text transcription</div>
          </div>
        </div>
        <div className={styles.inputWrap}>
          <input
            className={styles.input}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            spellCheck={false}
            autoComplete="off"
          />
          <button className={styles.eyeBtn} onClick={() => setShowKey((v) => !v)}
            title={showKey ? 'Hide key' : 'Show key'}>
            {showKey ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* API Usage */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardLabel}>API Usage</div>
            <div className={styles.cardDesc}>Credit balance and current month spend from your OpenAI account</div>
          </div>
        </div>
        <div className={styles.usageGrid}>
          <div className={styles.usageItem}>
            <div className={styles.usageLabel}>Credits remaining</div>
            <div className={styles.usageValue}>{formatUsd(usage?.creditsRemainingUsd ?? null)}</div>
          </div>
          <div className={styles.usageItem}>
            <div className={styles.usageLabel}>Credits used</div>
            <div className={styles.usageValue}>{formatUsd(usage?.creditsUsedUsd ?? null)}</div>
          </div>
          <div className={styles.usageItem}>
            <div className={styles.usageLabel}>Credits granted</div>
            <div className={styles.usageValue}>{formatUsd(usage?.creditsGrantedUsd ?? null)}</div>
          </div>
          <div className={styles.usageItem}>
            <div className={styles.usageLabel}>This month ({usage?.periodStart ?? '—'} to {usage?.periodEnd ?? '—'})</div>
            <div className={styles.usageValue}>{formatUsd(usage?.monthUsageUsd ?? null)}</div>
          </div>
        </div>
        <div className={styles.usageFooter}>
          <div className={styles.usageMeta}>
            {usage ? `Last update: ${formatDateTime(usage.fetchedAt)}` : 'No usage data loaded yet'}
          </div>
          <button
            className={styles.usageBtn}
            onClick={() => void refreshUsage(apiKey)}
            disabled={usageLoading}
          >
            {usageLoading ? 'Refreshing…' : 'Refresh usage'}
          </button>
        </div>
        {usageError && <div className={styles.usageError}>{usageError}</div>}
      </div>

      {/* Microphone */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardLabel}>Microphone</div>
            <div className={styles.cardDesc}>Audio input device for recording</div>
          </div>
        </div>
        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            disabled={devices.length === 0}
          >
            {devices.length === 0 && (
              <option value="default">Awaiting permission…</option>
            )}
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
          <span className={styles.selectArrow}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </div>
      </div>

      {/* Hotkey */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardLabel}>Recording Hotkey</div>
            <div className={styles.cardDesc}>Global key to start / stop recording</div>
          </div>
        </div>
        <div className={styles.hotkeyWrap}>
          <input
            ref={hotkeyInputRef}
            className={`${styles.hotkeyInput}${recording ? ` ${styles.recording}` : ''}`}
            value={hotkey}
            readOnly
            onKeyDown={handleHotkeyKeyDown}
            onBlur={handleHotkeyBlur}
          />
          <button
            className={`${styles.recordBtn}${recording ? ` ${styles.active}` : ''}`}
            onClick={startRecording}
          >
            {recording ? '● Listening…' : 'Set key'}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={`${styles.status} ${status ? styles[status.type] : styles.hidden}`}>
          {status && <span className={styles.statusDot} />}
          {status?.message}
        </div>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
