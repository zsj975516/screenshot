'use strict'

import {app, BrowserWindow, globalShortcut, screen, Tray, nativeImage, dialog, Menu} from 'electron'

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

let tray
const image = require('./image.js')
let logo = nativeImage.createFromBuffer(Buffer.from(image, 'base64'))

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  tray.destroy()
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    dialog.showMessageBox(mainWindow, {type: 'warning', title: '系统提示', message: '请勿重复运行！'})
  })
}

function createWindow () {
  /**
   * Initial window options
   */
  let screenSize = {width: 0, height: 0}
  screen.getAllDisplays().map((display, index) => {
    screenSize.width = Math.max(screenSize.width, display.bounds.x + display.bounds.width)
    screenSize.height = Math.max(screenSize.height, display.bounds.y + display.bounds.height)
  })

  mainWindow = new BrowserWindow({
    x: 0,
    y: 0,
    frame: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    icon: logo,
    transparent: true
  })

  mainWindow.setPosition(0, 0)
  mainWindow.setSize(screenSize.width, screenSize.height)
  mainWindow.setMenu(null)

  mainWindow.loadURL(winURL)

  mainWindow.on('closed', () => {
    mainWindow = null
    if (process.platform !== 'darwin') {
      tray.destroy()
      app.quit()
    }
  })
  globalShortcut.register('CommandOrControl+Q', () => {
    mainWindow.webContents.send('screenshot')
  })
  tray = new Tray(logo)
  tray.setToolTip('双击图标截图（Ctrl+Q）')
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '退出',
      type: 'normal',
      click: () => {
        tray.destroy()
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    mainWindow.webContents.send('screenshot')
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
