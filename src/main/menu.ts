import {
  app,
  BrowserWindow,
  Menu,
  type MenuItemConstructorOptions
} from 'electron'
import { Channels } from '@shared/ipc-channels'

export function applyAppMenu(win: BrowserWindow, isDev: boolean): void {
  const isMac = process.platform === 'darwin'

  const send = (channel: string): void => {
    if (!win.isDestroyed()) win.webContents.send(channel)
  }

  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }

  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  }

  const viewSubmenu: MenuItemConstructorOptions[] = [
    {
      label: 'Command Palette…',
      accelerator: 'CmdOrCtrl+K',
      click: () => send(Channels.MenuCommandPalette)
    },
    { type: 'separator' }
  ]

  if (isDev) {
    viewSubmenu.push(
      { role: 'reload' },
      { role: 'toggleDevTools' },
      { type: 'separator' }
    )
  }

  viewSubmenu.push({ role: 'togglefullscreen' })

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: viewSubmenu
  }

  const template: MenuItemConstructorOptions[] = []
  if (isMac) {
    template.push(appMenu, editMenu, viewMenu)
  } else {
    template.push(
      { label: 'File', submenu: [{ role: 'quit' }] },
      editMenu,
      viewMenu
    )
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
