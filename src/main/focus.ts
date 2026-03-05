import { execFileSync, spawn } from 'child_process'

/**
 * Returns the active X11 window ID before the pill is shown.
 * Returns null if xdotool is not available or fails.
 */
export function captureActiveWindow(): string | null {
  try {
    // execFileSync (not exec/execSync) — no shell interpolation
    const id = execFileSync('xdotool', ['getactivewindow'], { encoding: 'utf8' }).trim()
    return id || null
  } catch {
    console.error('[focus] xdotool getactivewindow failed')
    return null
  }
}

/**
 * Types text into the given window using xdotool via stdin.
 * Uses spawn + stdin to avoid shell-quoting issues with special chars (é, à, etc).
 * The windowId comes from xdotool itself (no user-controlled input in args).
 * Text is written to stdin, never interpolated into the command.
 */
export function typeIntoWindow(windowId: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Arguments are an array — no shell, no injection risk
    const proc = spawn('xdotool', [
      'windowfocus', '--sync', windowId,
      'type', '--clearmodifiers', '--delay', '12', '--window', windowId, '--'
    ])

    proc.stdin.write(text)
    proc.stdin.end()

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`xdotool exited with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}
