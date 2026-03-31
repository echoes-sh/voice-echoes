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

interface UsageSnapshot {
  monthUsageUsd: number | null
  creditRemainingUsd: number | null
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
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [usage, setUsage]       = useState<UsageSnapshot | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const hotkeyInputRef = useRef<HTMLInputElement>(null)

  const formatUsd = useCallback((value: number | null) => {
    if (value === null) return '—'
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 4
    }).format(value)
  }, [])

  const refreshUsage = useCallback(async (key: string) => {
    if (!key.trim()) return
    setUsageLoading(true)
    try {
      const snapshot = await window.electronAPI.settingsUsage(key.trim())
      setUsage(snapshot)
    } catch (err) {
      setUsage({ monthUsageUsd: null, periodStart: '', periodEnd: '', fetchedAt: '', error: (err as Error).message })
    } finally {
      setUsageLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialKey.trim()) void refreshUsage(initialKey)
  }, [initialKey, refreshUsage])

  // ── Enumerate audio inputs ─────────────────────────────
  useEffect(() => {
    async function loadDevices() {
      try {
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

  // ── Auto-launch ─────────────────────────────────────
  useEffect(() => {
    window.electronAPI.getAutoLaunch().then(setAutoLaunch)
  }, [])

  const handleAutoLaunchToggle = useCallback(async () => {
    const next = !autoLaunch
    setAutoLaunch(next)
    await window.electronAPI.setAutoLaunch(next)
  }, [autoLaunch])

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
      if (e.metaKey)  modifiers.push(navigator.platform.startsWith('Mac') ? 'Command' : 'Super')

      const skip = ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph']
      if (skip.includes(e.key)) return

      // Map physical key codes to Electron accelerator names
      const codeMap: Record<string, string> = {
        Space: 'Space', ArrowUp: 'Up', ArrowDown: 'Down',
        ArrowLeft: 'Left', ArrowRight: 'Right',
        Escape: 'Escape', Tab: 'Tab', Enter: 'Return',
        Backspace: 'Backspace', Delete: 'Delete',
        Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']',
        Backquote: '`', Minus: '-', Equal: '=',
        Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
      }
      let mapped: string
      if (codeMap[e.code]) {
        mapped = codeMap[e.code]
      } else if (e.code.startsWith('Key')) {
        mapped = e.code.slice(3) // KeyA -> A
      } else if (e.code.startsWith('Digit')) {
        mapped = e.code.slice(5) // Digit1 -> 1
      } else if (e.code.startsWith('F') && /^F\d+$/.test(e.code)) {
        mapped = e.code // F1, F2, etc.
      } else {
        mapped = e.code
      }
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
        <div className={styles.version}>v1.0.6</div>
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
          <div className={styles.cardLabelRow}>
            <svg className={styles.cardIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
            <div>
              <div className={styles.cardLabel}>OpenAI API Key</div>
              <div className={styles.cardDesc}>Used for Whisper speech-to-text</div>
            </div>
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

      {/* Usage */}
      <div className={styles.card}>
        <div className={styles.usageRow}>
          <div className={styles.cardLabelRow}>
            <svg className={styles.cardIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20V10M18 20V4M6 20v-4"/>
            </svg>
            <div>
              <div className={styles.cardLabel}>API Usage</div>
              <div className={styles.usagePeriod}>
                {usage ? `${usage.periodStart} — ${usage.periodEnd}` : 'Current month'}
              </div>
            </div>
          </div>
          <div className={styles.usageRight}>
            <div className={styles.usageAmount}>
              {usageLoading ? '…' : formatUsd(usage?.monthUsageUsd ?? null)}
            </div>
            <button
              className={styles.usageRefreshBtn}
              onClick={() => void refreshUsage(apiKey)}
              disabled={usageLoading || !apiKey.trim()}
              title="Refresh usage"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>
        </div>
        {usage && (
          <div className={styles.creditRow}>
            <span className={styles.creditLabel}>Credit left</span>
            <span className={styles.creditAmount}>
              {usageLoading ? '…' : formatUsd(usage.creditRemainingUsd ?? null)}
            </span>
          </div>
        )}
        {usage?.error && <div className={styles.usageError}>{usage.error}</div>}
      </div>

      {/* Microphone */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardLabelRow}>
            <svg className={styles.cardIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <div>
              <div className={styles.cardLabel}>Microphone</div>
              <div className={styles.cardDesc}>Audio input device for recording</div>
            </div>
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
          <div className={styles.cardLabelRow}>
            <svg className={styles.cardIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>
            </svg>
            <div>
              <div className={styles.cardLabel}>Recording Hotkey</div>
              <div className={styles.cardDesc}>Global key to start / stop recording</div>
            </div>
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
            {recording ? 'Listening…' : 'Set key'}
          </button>
        </div>
      </div>

      {/* Start at Login */}
      <div className={styles.card}>
        <div className={styles.toggleRow}>
          <div className={styles.cardLabelRow}>
            <svg className={styles.cardIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            <div>
              <div className={styles.cardLabel}>Start at Login</div>
              <div className={styles.toggleDesc}>Automatically launch when you log in</div>
            </div>
          </div>
          <button
            className={`${styles.toggle} ${autoLaunch ? styles.toggleOn : ''}`}
            onClick={handleAutoLaunchToggle}
            role="switch"
            aria-checked={autoLaunch}
          >
            <span className={styles.toggleThumb} />
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
