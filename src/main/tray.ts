import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { openSettings } from './index'

let tray: Tray | null = null

export function setupTray(pill: BrowserWindow): void {
  void pill // reserved for future tray–pill interaction

  const iconPath = join(
    app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources'),
    'tray-icon.png'
  )
  const icon = nativeImage.createFromPath(iconPath)
  const resized = icon.isEmpty()
    ? nativeImage.createEmpty()
    : icon.resize({ width: 22, height: 22 })

  if (process.platform === 'darwin') {
    resized.setTemplateImage(true)
  }

  tray = new Tray(resized)
  tray.setToolTip('Voice Echoes')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Voice Echoes', enabled: false },
    { type: 'separator' },
    { label: 'Settings…', click: () => openSettings() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => openSettings())
}
