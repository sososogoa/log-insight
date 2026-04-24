import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { existsSync } from 'fs'
import { join } from 'path'
import { registerIpcHandlers } from './ipc/register'
import { disposeAll } from './pty/pty-manager'
import { stopAllStreams } from './ssh/log-stream'
import { applyAppMenu } from './menu'

app.setName('LogInsight')

function resolveIconPath(): string | null {
  // packaged app — icon sits next to main bundle via electron-builder
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(__dirname, '../../resources/icon.png'),
    join(process.cwd(), 'build/icon.png')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

function createWindow(): BrowserWindow {
  const iconPath = resolveIconPath()
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    title: 'LogInsight',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  applyAppMenu(win, is.dev)
  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('dev.biglink.loginsight')
  app.setAboutPanelOptions({
    applicationName: 'LogInsight',
    applicationVersion: app.getVersion(),
    credits: 'AI-connected realtime log streaming',
    copyright: ''
  })

  // In dev the dock icon is the stock Electron one because the app runs from
  // the Electron binary's bundle. Set it explicitly if we have a build icon.
  const iconPath = resolveIconPath()
  if (iconPath && process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(nativeImage.createFromPath(iconPath))
    } catch {
      // non-fatal
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopAllStreams()
  disposeAll()
})

app.on('will-quit', (e) => {
  e.preventDefault()
  stopAllStreams()
  disposeAll()
  app.exit(0)
})

app.on('window-all-closed', () => {
  // In dev, the shell parent (pnpm dev) may SIGTERM us before any quit event
  // fires. Reap native resources eagerly so late PTY/SSH data events don't hit
  // a destroyed WebContents.
  stopAllStreams()
  disposeAll()
  if (process.platform !== 'darwin') app.quit()
})

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => {
    stopAllStreams()
    disposeAll()
    app.exit(0)
  })
}
