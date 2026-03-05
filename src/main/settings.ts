import { readFileSync, writeFileSync, existsSync } from 'fs'
import { parse } from 'dotenv'
import { join } from 'path'
import { app } from 'electron'

function getEnvPath(): string {
  return app.isPackaged
    ? join(app.getPath('userData'), '.env')
    : join(process.cwd(), '.env')
}

export function readSettings(): { apiKey: string; hotkey: string; deviceId: string } {
  const path = getEnvPath()
  if (!existsSync(path)) return { apiKey: '', hotkey: 'F13', deviceId: 'default' }
  const content = readFileSync(path, 'utf8')
  const parsed = parse(content)
  return {
    apiKey: parsed.OPENAI_API_KEY || '',
    hotkey: parsed.HOTKEY || 'F13',
    deviceId: parsed.MIC_DEVICE_ID || 'default'
  }
}

export function writeSettings(apiKey: string, hotkey: string, deviceId: string): void {
  const path = getEnvPath()
  let content = existsSync(path) ? readFileSync(path, 'utf8') : ''

  content = setEnvVar(content, 'OPENAI_API_KEY', apiKey)
  content = setEnvVar(content, 'HOTKEY', hotkey)
  content = setEnvVar(content, 'MIC_DEVICE_ID', deviceId)

  writeFileSync(path, content, 'utf8')

  process.env.OPENAI_API_KEY = apiKey
  process.env.HOTKEY = hotkey
  process.env.MIC_DEVICE_ID = deviceId
}

function setEnvVar(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm')
  const line = `${key}=${value}`
  if (regex.test(content)) {
    return content.replace(regex, line)
  }
  return content + (content.endsWith('\n') ? '' : '\n') + line + '\n'
}
