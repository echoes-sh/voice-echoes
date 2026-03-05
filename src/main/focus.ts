import { execFileSync, execSync, spawn } from 'child_process'
import { clipboard } from 'electron'

const isWin = process.platform === 'win32'

/**
 * Returns an identifier for the active window before the pill is shown.
 * On Linux uses xdotool, on Windows returns a placeholder (we use clipboard paste instead).
 */
export function captureActiveWindow(): string | null {
  if (isWin) {
    // On Windows we use clipboard-based paste, no window ID needed
    return 'win-clipboard'
  }

  try {
    const id = execFileSync('xdotool', ['getactivewindow'], { encoding: 'utf8' }).trim()
    return id || null
  } catch {
    console.error('[focus] xdotool getactivewindow failed')
    return null
  }
}

/**
 * Types text into the previously active window.
 * On Windows: copies text to clipboard and simulates Ctrl+V via PowerShell.
 * On Linux: uses xdotool via stdin.
 */
export function typeIntoWindow(windowId: string, text: string): Promise<void> {
  if (isWin) {
    return new Promise((resolve, reject) => {
      try {
        clipboard.writeText(text)
        // Use PowerShell to send Ctrl+V to the foreground app
        execSync(
          'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"',
          { timeout: 5000 }
        )
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  }

  return new Promise((resolve, reject) => {
    const proc = spawn('xdotool', [
      'windowfocus', '--sync', windowId,
      'type', '--clearmodifiers', '--delay', '12', '--window', windowId, '--'
    ])

    proc.stdin.write(text)
    proc.stdin.end()

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`xdotool exited with code ${code}`))
    })

    proc.on('error', reject)
  })
}
